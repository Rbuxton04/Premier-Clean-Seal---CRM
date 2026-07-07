import { isMapboxServerConfigured, isWithinGB } from "@/services/geocode.service";
import { listJobsForMap, ensurePropertyGeocoded, type MapJobItem } from "@/services/map.service";

// Mapbox Optimization API v1 accepts at most 12 coordinates per request
// (origin + up to 11 stops). Days with more stops than that are optimised
// in consecutive batches, chaining each batch's last stop as the next
// batch's origin — not a globally optimal tour across the whole day, but a
// pragmatic approximation that never errors, and at current volume
// (~10 stops/technician/day) this path won't even trigger.
const MAX_STOPS_PER_BATCH = 11;

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
  if (stops.length <= MAX_STOPS_PER_BATCH) {
    return callMapboxOptimization(origin, stops);
  }

  let currentOrigin = origin;
  const orderedStops: StopCandidate[] = [];
  const legs: Array<{ distance: number; duration: number }> = [];
  const geometryCoords: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < stops.length; i += MAX_STOPS_PER_BATCH) {
    const chunk = stops.slice(i, i + MAX_STOPS_PER_BATCH);
    const result = await callMapboxOptimization(currentOrigin, chunk);
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

/**
 * Single Mapbox Optimization API call: origin fixed as the start
 * (source=first), no forced end point (destination defaults to "any" so the
 * algorithm can end wherever is genuinely closest), no return leg
 * (roundtrip=false) since a technician doesn't need to drive home between
 * jobs. Uses the plain "driving" profile — Optimization API v1 doesn't
 * support the traffic-aware "driving-traffic" profile (that requires
 * Mapbox's newer async Optimization v2 API, out of scope here).
 */
async function callMapboxOptimization(
  origin: { latitude: number; longitude: number },
  stops: StopCandidate[]
): Promise<OptimizeResult> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) return { ok: false, reason: "MAPBOX_SECRET_TOKEN is not set" };

  // Mapbox coordinate order is always longitude,latitude — a lat/lng swap
  // here would both misplace pins and make every optimisation call fail.
  const coords = [origin, ...stops].map((p) => `${p.longitude},${p.latitude}`).join(";");
  const url =
    `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&roundtrip=false&source=first&access_token=${token}`;

  try {
    const res = await fetch(url);
    const bodyText = await res.text();

    if (!res.ok) {
      console.error(`Mapbox Optimization API failed: HTTP ${res.status} - ${bodyText}`);
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: "check MAPBOX_SECRET_TOKEN scopes/validity" };
      }
      return { ok: false, reason: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` };
    }

    const data = JSON.parse(bodyText) as {
      code?: string;
      message?: string;
      trips?: Array<{
        geometry: { coordinates: [number, number][] };
        legs: Array<{ distance: number; duration: number }>;
        distance: number;
        duration: number;
      }>;
      waypoints?: Array<{ waypoint_index: number }>;
    };

    if (data.code !== "Ok" || !data.trips?.[0] || !data.waypoints) {
      const reason = `Mapbox returned ${data.code ?? "an unknown error"}${data.message ? `: ${data.message}` : ""}`;
      console.error(`Mapbox Optimization API error: ${reason}`);
      return { ok: false, reason };
    }

    const trip = data.trips[0];
    // waypoints[0] is the origin (forced first); waypoints[1..] align by
    // input order with `stops` — each carries the stop's position in the
    // optimised visiting order.
    const stopWaypoints = data.waypoints.slice(1);
    if (stopWaypoints.length !== stops.length) {
      return { ok: false, reason: "Mapbox returned an unexpected number of waypoints" };
    }

    const orderedStops = stops
      .map((stop, i) => ({ stop, visitIndex: stopWaypoints[i].waypoint_index }))
      .sort((a, b) => a.visitIndex - b.visitIndex)
      .map(({ stop }) => stop);

    return {
      ok: true,
      orderedStops,
      legs: trip.legs,
      geometryCoords: trip.geometry.coordinates,
      totalDistance: trip.distance,
      totalDuration: trip.duration,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network error";
    console.error("Mapbox Optimization API request threw:", err);
    return { ok: false, reason };
  }
}
