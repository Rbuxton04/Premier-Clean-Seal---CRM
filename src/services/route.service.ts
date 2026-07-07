import { isMapboxServerConfigured, isWithinGB } from "@/services/geocode.service";
import { listJobsForMap, ensurePropertyGeocoded, type MapJobItem } from "@/services/map.service";

// The Mapbox Optimization API (true TSP solving) isn't available on this
// account's plan/token — calling it returns "NotImplemented". The Directions
// API is available and gives real drive times/geometry, but it doesn't
// reorder waypoints itself, so visiting order is decided locally (nearest
// neighbour, see nearestNeighbourOrder below) before a single Directions
// call fills in the actual route.
//
// The Directions API accepts at most 25 coordinates per request (origin +
// up to 24 stops). Days with more stops than that are routed in consecutive
// batches, chaining each batch's last stop as the next batch's origin — not
// a globally optimal tour across the whole day, but a pragmatic
// approximation that never errors, and at current volume
// (~10 stops/technician/day) this path won't even trigger.
const MAX_STOPS_PER_BATCH = 24;

export type RouteStop = {
  jobId: string;
  jobNumber: string;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
  order: number;
  legDistanceMeters: number | null;
  legDurationSeconds: number | null;
};

export type RouteOrigin = { latitude: number; longitude: number; source: "geolocation" | "manual" | "first-job" };

export type PlanRouteResult =
  | { ok: false; message: string }
  | {
      ok: true;
      optimized: boolean;
      origin: RouteOrigin;
      stops: RouteStop[];
      totalDistanceMeters: number | null;
      totalDurationSeconds: number | null;
      geometry: { type: "LineString"; coordinates: [number, number][] } | null;
      unroutedJobIds: string[];
      message?: string;
    };

export type PlanRouteInput = {
  technicianId: string;
  dateISO: string;
  origin: { latitude: number; longitude: number } | null;
  originSource: "geolocation" | "manual" | null;
};

type StopCandidate = { job: MapJobItem; latitude: number; longitude: number };

function formatAddress(property: NonNullable<MapJobItem["property"]>): string {
  return [property.addressLine1, property.city, property.postcode].filter(Boolean).join(", ");
}

export async function planRoute(input: PlanRouteInput): Promise<PlanRouteResult> {
  const jobs = await listJobsForMap(input.dateISO, input.technicianId);
  if (jobs.length === 0) {
    return { ok: false, message: "No jobs scheduled for this technician on this day." };
  }

  const stopCandidates: StopCandidate[] = [];
  const unroutedJobIds: string[] = [];
  for (const job of jobs) {
    if (!job.property) {
      unroutedJobIds.push(job.id);
      continue;
    }
    let latitude = job.property.latitude;
    let longitude = job.property.longitude;
    if (latitude == null || longitude == null) {
      const geocoded = await ensurePropertyGeocoded(job.property.id);
      if (!geocoded) {
        unroutedJobIds.push(job.id);
        continue;
      }
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }
    stopCandidates.push({ job, latitude, longitude });
  }

  if (stopCandidates.length === 0) {
    return { ok: false, message: "None of today's jobs could be located on the map yet — check their addresses." };
  }

  const origin: RouteOrigin = input.origin
    ? { ...input.origin, source: input.originSource ?? "manual" }
    : { latitude: stopCandidates[0].latitude, longitude: stopCandidates[0].longitude, source: "first-job" };

  if (!isMapboxServerConfigured()) {
    return scheduledOrderFallback(stopCandidates, origin, unroutedJobIds, "Mapbox isn't configured — showing jobs in scheduled order.");
  }

  // Sanity-check every coordinate before spending a Mapbox call on it — a
  // stray bad geocode (or a manually-typed origin outside GB) would
  // otherwise send Mapbox an input it can only reject, which used to surface
  // as an unexplained "temporarily unavailable".
  const outOfBounds = [origin, ...stopCandidates].find((p) => !isWithinGB(p.latitude, p.longitude));
  if (outOfBounds) {
    return scheduledOrderFallback(
      stopCandidates,
      origin,
      unroutedJobIds,
      "Route optimisation skipped: one or more coordinates are outside Great Britain — re-geocode the affected properties and try again."
    );
  }

  const optimized = await planOptimizedRoute(origin, stopCandidates);
  if (!optimized.ok) {
    console.error(`Route optimisation fell back to scheduled order: ${optimized.reason}`);
    return scheduledOrderFallback(
      stopCandidates,
      origin,
      unroutedJobIds,
      `Route optimisation failed (${optimized.reason}) — showing jobs in scheduled order.`
    );
  }

  const stops: RouteStop[] = optimized.orderedStops.map((s, i) => {
    const leg = optimized.legs[i];
    return {
      jobId: s.job.id,
      jobNumber: s.job.jobNumber,
      customerName: s.job.customer.name,
      address: formatAddress(s.job.property!),
      latitude: s.latitude,
      longitude: s.longitude,
      order: i + 1,
      legDistanceMeters: leg?.distance ?? null,
      legDurationSeconds: leg?.duration ?? null,
    };
  });

  return {
    ok: true,
    optimized: true,
    origin,
    stops,
    totalDistanceMeters: optimized.totalDistance,
    totalDurationSeconds: optimized.totalDuration,
    geometry: { type: "LineString", coordinates: optimized.geometryCoords },
    unroutedJobIds,
  };
}

function scheduledOrderFallback(
  stopCandidates: StopCandidate[],
  origin: RouteOrigin,
  unroutedJobIds: string[],
  message: string
): PlanRouteResult {
  // stopCandidates preserves listJobsForMap's orderBy: scheduledStart asc.
  const stops: RouteStop[] = stopCandidates.map((s, i) => ({
    jobId: s.job.id,
    jobNumber: s.job.jobNumber,
    customerName: s.job.customer.name,
    address: formatAddress(s.job.property!),
    latitude: s.latitude,
    longitude: s.longitude,
    order: i + 1,
    legDistanceMeters: null,
    legDurationSeconds: null,
  }));
  return {
    ok: true,
    optimized: false,
    origin,
    stops,
    totalDistanceMeters: null,
    totalDurationSeconds: null,
    geometry: null,
    unroutedJobIds,
    message,
  };
}

type OptimizeResult =
  | {
      ok: true;
      orderedStops: StopCandidate[];
      legs: Array<{ distance: number; duration: number }>;
      geometryCoords: [number, number][];
      totalDistance: number;
      totalDuration: number;
    }
  | { ok: false; reason: string };

async function planOptimizedRoute(origin: { latitude: number; longitude: number }, stops: StopCandidate[]): Promise<OptimizeResult> {
  // Decide the whole day's visiting order up front (nearest neighbour from
  // the origin), then route it in batches of at most MAX_STOPS_PER_BATCH —
  // batching only affects how many Directions calls it takes, not the order.
  const ordered = nearestNeighbourOrder(origin, stops);

  let currentOrigin = origin;
  const orderedStops: StopCandidate[] = [];
  const legs: Array<{ distance: number; duration: number }> = [];
  const geometryCoords: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < ordered.length; i += MAX_STOPS_PER_BATCH) {
    const chunk = ordered.slice(i, i + MAX_STOPS_PER_BATCH);
    const result = await callMapboxDirections(currentOrigin, chunk);
    if (!result.ok) return result;
    orderedStops.push(...result.orderedStops);
    legs.push(...result.legs);
    geometryCoords.push(...result.geometryCoords);
    totalDistance += result.totalDistance;
    totalDuration += result.totalDuration;
    const last = result.orderedStops[result.orderedStops.length - 1];
    currentOrigin = { latitude: last.latitude, longitude: last.longitude };
  }

  return { ok: true, orderedStops, legs, geometryCoords, totalDistance, totalDuration };
}

/** Great-circle distance in metres — used only to build a local visiting order, never sent to Mapbox. */
function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Greedy nearest-neighbour visiting order. The Directions API (unlike the
 * unavailable Optimization API) doesn't reorder waypoints itself, so this
 * decides the order locally from straight-line distance before the single
 * Directions call below fills in real roads/times for that fixed order.
 * Not a globally optimal tour, but a solid approximation at the stop counts
 * a technician actually has in a day.
 */
function nearestNeighbourOrder(origin: { latitude: number; longitude: number }, stops: StopCandidate[]): StopCandidate[] {
  const remaining = [...stops];
  const ordered: StopCandidate[] = [];
  let current: { latitude: number; longitude: number } = origin;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineMeters(current, remaining[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

/**
 * Single Mapbox Directions API call over a fixed, already-ordered list of
 * stops — returns real drive legs + route geometry for that order. Tries
 * the traffic-aware "driving-traffic" profile first (not available on every
 * account/region) and falls back to plain "driving" on any failure from
 * that first attempt, since a live-traffic estimate is a nice-to-have, not
 * something worth failing the whole route over.
 */
async function callMapboxDirections(
  origin: { latitude: number; longitude: number },
  orderedStops: StopCandidate[]
): Promise<OptimizeResult> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) return { ok: false, reason: "MAPBOX_SECRET_TOKEN is not set" };

  // Mapbox coordinate order is always longitude,latitude — a lat/lng swap
  // here would both misplace pins and make every routing call fail.
  const coords = [origin, ...orderedStops].map((p) => `${p.longitude},${p.latitude}`).join(";");

  async function requestProfile(profile: "driving-traffic" | "driving") {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
      `?geometries=geojson&overview=full&steps=false&access_token=${token}`;
    const res = await fetch(url);
    const bodyText = await res.text();
    return { res, bodyText };
  }

  try {
    let { res, bodyText } = await requestProfile("driving-traffic");
    let parsed = safeParseJson(bodyText);
    if (!res.ok || parsed?.code !== "Ok") {
      // driving-traffic unavailable/unsupported here — retry with the
      // baseline profile before treating this as a real failure.
      ({ res, bodyText } = await requestProfile("driving"));
      parsed = safeParseJson(bodyText);
    }

    if (!res.ok) {
      console.error(`Mapbox Directions API failed: HTTP ${res.status} - ${bodyText}`);
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: "check MAPBOX_SECRET_TOKEN scopes/validity" };
      }
      return { ok: false, reason: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` };
    }

    const data = parsed as {
      code?: string;
      message?: string;
      routes?: Array<{
        geometry: { coordinates: [number, number][] };
        legs: Array<{ distance: number; duration: number }>;
        distance: number;
        duration: number;
      }>;
    } | null;

    if (!data || data.code !== "Ok" || !data.routes?.[0]) {
      const reason = `Mapbox returned ${data?.code ?? "an unknown error"}${data?.message ? `: ${data.message}` : ""}`;
      console.error(`Mapbox Directions API error: ${reason}`);
      return { ok: false, reason };
    }

    const route = data.routes[0];
    // Coordinates are [origin, ...orderedStops], so there's one leg per
    // stop: legs[i] is the drive arriving at orderedStops[i].
    if (route.legs.length !== orderedStops.length) {
      return { ok: false, reason: "Mapbox returned an unexpected number of legs" };
    }

    return {
      ok: true,
      orderedStops,
      legs: route.legs,
      geometryCoords: route.geometry.coordinates,
      totalDistance: route.distance,
      totalDuration: route.duration,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network error";
    console.error("Mapbox Directions API request threw:", err);
    return { ok: false, reason };
  }
}

function safeParseJson(text: string): { code?: string; message?: string } | null {
  try {
    return JSON.parse(text) as { code?: string; message?: string };
  } catch {
    return null;
  }
}
