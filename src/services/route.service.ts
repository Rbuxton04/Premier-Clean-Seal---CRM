import { geocodeAddress, isMapboxServerConfigured, isWithinGB } from "@/services/geocode.service";
import { listJobsForMap, ensurePropertyGeocoded, type MapJobItem } from "@/services/map.service";
import { getTechnicianHome } from "@/services/user.service";

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

// The fixed finish point a plan can end at — origin stays first, this stays
// last, and only the job stops in between get reordered for efficiency.
export type RouteFinish = {
  label: string;
  address: string | null;
  latitude: number;
  longitude: number;
  legDistanceMeters: number | null;
  legDurationSeconds: number | null;
};

export type PlanRouteResult =
  | { ok: false; message: string }
  | {
      ok: true;
      optimized: boolean;
      origin: RouteOrigin;
      stops: RouteStop[];
      finish: RouteFinish | null;
      totalDistanceMeters: number | null;
      totalDurationSeconds: number | null;
      geometry: { type: "LineString"; coordinates: [number, number][] } | null;
      unroutedJobIds: string[];
      message?: string;
    };

export type FinishMode = "home" | "none" | "custom";

export type PlanRouteInput = {
  technicianId: string;
  dateISO: string;
  origin: { latitude: number; longitude: number } | null;
  originSource: "geolocation" | "manual" | null;
  // Defaults to "home" when omitted — see resolveFinish.
  finishMode?: FinishMode;
  // Only used when finishMode is "custom"; geocoded for this plan only and
  // never saved as the technician's home address.
  customFinishAddress?: string | null;
};

type StopCandidate = { job: MapJobItem; latitude: number; longitude: number };

// A resolved finish candidate before routing — same shape whether it came
// from the technician's saved home or a one-off custom address.
type FinishCandidate = { latitude: number; longitude: number; label: string; address: string | null };

// Full postal address including postcode — this is the single source of
// truth used both for the on-screen stop list and, in nav-links.ts, for the
// Google/Apple Maps navigation hand-off. Passing the complete address
// (rather than bare coordinates) anchors the maps app to the exact
// property, since a raw lat/lng gets reverse-geocoded and can resolve to a
// neighbouring house number.
function formatAddress(property: NonNullable<MapJobItem["property"]>): string {
  return [property.addressLine1, property.addressLine2, property.city, property.postcode].filter(Boolean).join(", ");
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

  const finishResolution = await resolveFinish(input.technicianId, input.finishMode ?? "home", input.customFinishAddress ?? null);

  if (!isMapboxServerConfigured()) {
    return scheduledOrderFallback(
      stopCandidates,
      origin,
      unroutedJobIds,
      "Mapbox isn't configured — showing jobs in scheduled order.",
      finishResolution
    );
  }

  // Sanity-check every coordinate before spending a Mapbox call on it — a
  // stray bad geocode (or a manually-typed origin outside GB) would
  // otherwise send Mapbox an input it can only reject, which used to surface
  // as an unexplained "temporarily unavailable".
  const outOfBounds = [origin, ...stopCandidates, ...(finishResolution.point ? [finishResolution.point] : [])].find(
    (p) => !isWithinGB(p.latitude, p.longitude)
  );
  if (outOfBounds) {
    return scheduledOrderFallback(
      stopCandidates,
      origin,
      unroutedJobIds,
      "Route optimisation skipped: one or more coordinates are outside Great Britain — re-geocode the affected properties and try again.",
      finishResolution
    );
  }

  const optimized = await planOptimizedRoute(origin, stopCandidates, finishResolution.point);
  if (!optimized.ok) {
    console.error(`Route optimisation fell back to scheduled order: ${optimized.reason}`);
    return scheduledOrderFallback(
      stopCandidates,
      origin,
      unroutedJobIds,
      `Route optimisation failed (${optimized.reason}) — showing jobs in scheduled order.`,
      finishResolution
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

  const finish: RouteFinish | null =
    finishResolution.point && optimized.finishLeg
      ? {
          label: finishResolution.point.label,
          address: finishResolution.point.address,
          latitude: finishResolution.point.latitude,
          longitude: finishResolution.point.longitude,
          legDistanceMeters: optimized.finishLeg.distance,
          legDurationSeconds: optimized.finishLeg.duration,
        }
      : null;

  return {
    ok: true,
    optimized: true,
    origin,
    stops,
    finish,
    totalDistanceMeters: optimized.totalDistance,
    totalDurationSeconds: optimized.totalDuration,
    geometry: { type: "LineString", coordinates: optimized.geometryCoords },
    unroutedJobIds,
    message: optimized.finishWarning ?? finishResolution.warning,
  };
}

/**
 * Resolves the "finish at" choice for a plan into a concrete point, before
 * any Mapbox call is made:
 *  - "none": no finish point.
 *  - "home": the technician's saved home (geocoded + cached on save — see
 *    setTechnicianHomeAddress). Silently resolves to no finish when nothing
 *    is saved yet, since the UI already defaults the toggle off in that case
 *    and this must never error.
 *  - "custom": a one-off address geocoded just for this plan (never saved).
 *    Falls back to the saved home, then to no finish, if it can't be
 *    located — never fails the whole plan over a bad finish address.
 */
async function resolveFinish(
  technicianId: string,
  mode: FinishMode,
  customAddress: string | null
): Promise<{ point: FinishCandidate | null; warning?: string }> {
  if (mode === "none") return { point: null };

  if (mode === "custom") {
    const trimmed = customAddress?.trim() ?? "";
    if (trimmed.length < 3) return { point: null };
    const geocoded = await geocodeAddress(trimmed);
    if (geocoded) {
      return { point: { latitude: geocoded.latitude, longitude: geocoded.longitude, label: "Finish", address: trimmed } };
    }
    const home = await getTechnicianHomePoint(technicianId);
    if (home) {
      return { point: home, warning: `Couldn't locate "${trimmed}" as a finish point — used the saved home address instead.` };
    }
    return { point: null, warning: `Couldn't locate "${trimmed}" as a finish point — planned without a finish point.` };
  }

  return { point: await getTechnicianHomePoint(technicianId) };
}

async function getTechnicianHomePoint(technicianId: string): Promise<FinishCandidate | null> {
  const home = await getTechnicianHome(technicianId);
  if (!home || home.homeLatitude == null || home.homeLongitude == null) return null;
  return { latitude: home.homeLatitude, longitude: home.homeLongitude, label: "Home", address: home.homeAddress };
}

function scheduledOrderFallback(
  stopCandidates: StopCandidate[],
  origin: RouteOrigin,
  unroutedJobIds: string[],
  message: string,
  finishResolution: { point: FinishCandidate | null; warning?: string }
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
  const finish: RouteFinish | null = finishResolution.point
    ? {
        label: finishResolution.point.label,
        address: finishResolution.point.address,
        latitude: finishResolution.point.latitude,
        longitude: finishResolution.point.longitude,
        legDistanceMeters: null,
        legDurationSeconds: null,
      }
    : null;
  return {
    ok: true,
    optimized: false,
    origin,
    stops,
    finish,
    totalDistanceMeters: null,
    totalDurationSeconds: null,
    geometry: null,
    unroutedJobIds,
    message: finishResolution.warning ? `${message} ${finishResolution.warning}` : message,
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
      finishLeg: { distance: number; duration: number } | null;
      finishWarning?: string;
    }
  | { ok: false; reason: string };

async function planOptimizedRoute(
  origin: { latitude: number; longitude: number },
  stops: StopCandidate[],
  finish: FinishCandidate | null
): Promise<OptimizeResult> {
  // Decide the whole day's visiting order up front (nearest neighbour from
  // the origin), then route it in batches of at most MAX_STOPS_PER_BATCH —
  // batching only affects how many Directions calls it takes, not the order.
  // finish is deliberately excluded from this ordering: it's a fixed last
  // stop, not a candidate to reorder in.
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

  // The finish point is routed as one extra leg from the last job stop,
  // rather than folded into a batch's Directions call — this sidesteps the
  // Directions API's 25-coordinate cap entirely (no per-batch arithmetic to
  // reserve a slot) and keeps a finish that fails to route from failing the
  // whole plan: it's simply dropped, with a warning surfaced to the caller.
  let finishLeg: { distance: number; duration: number } | null = null;
  let finishWarning: string | undefined;
  if (finish) {
    const finishResult = await callFinishLeg(currentOrigin, finish);
    if (finishResult.ok) {
      finishLeg = { distance: finishResult.distance, duration: finishResult.duration };
      geometryCoords.push(...finishResult.geometryCoords);
      totalDistance += finishResult.distance;
      totalDuration += finishResult.duration;
    } else {
      console.error(`Finish-point routing failed: ${finishResult.reason}`);
      finishWarning = "Couldn't route to the finish point — showing the route to the last job only.";
    }
  }

  return { ok: true, orderedStops, legs, geometryCoords, totalDistance, totalDuration, finishLeg, finishWarning };
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

type DirectionsRouteData = {
  legs: Array<{ distance: number; duration: number }>;
  geometryCoords: [number, number][];
  totalDistance: number;
  totalDuration: number;
};
type DirectionsFetchResult = { ok: true; data: DirectionsRouteData } | { ok: false; reason: string };

/**
 * Shared Mapbox Directions API request over a semicolon-joined "lng,lat"
 * coordinate string. Tries the traffic-aware "driving-traffic" profile first
 * (not available on every account/region) and falls back to plain "driving"
 * on any failure from that first attempt, since a live-traffic estimate is a
 * nice-to-have, not something worth failing the whole route over. Used both
 * for the batched job-stops call and the single-leg finish call below.
 */
async function fetchDirectionsRoute(coords: string): Promise<DirectionsFetchResult> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) return { ok: false, reason: "MAPBOX_SECRET_TOKEN is not set" };

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
    return {
      ok: true,
      data: {
        legs: route.legs,
        geometryCoords: route.geometry.coordinates,
        totalDistance: route.distance,
        totalDuration: route.duration,
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network error";
    console.error("Mapbox Directions API request threw:", err);
    return { ok: false, reason };
  }
}

/** Directions call over a fixed, already-ordered list of stops — returns real drive legs + route geometry for that order. */
async function callMapboxDirections(
  origin: { latitude: number; longitude: number },
  orderedStops: StopCandidate[]
): Promise<OptimizeResult> {
  // Mapbox coordinate order is always longitude,latitude — a lat/lng swap
  // here would both misplace pins and make every routing call fail.
  const coords = [origin, ...orderedStops].map((p) => `${p.longitude},${p.latitude}`).join(";");
  const result = await fetchDirectionsRoute(coords);
  if (!result.ok) return result;

  // Coordinates are [origin, ...orderedStops], so there's one leg per stop:
  // legs[i] is the drive arriving at orderedStops[i].
  if (result.data.legs.length !== orderedStops.length) {
    return { ok: false, reason: "Mapbox returned an unexpected number of legs" };
  }

  return {
    ok: true,
    orderedStops,
    legs: result.data.legs,
    geometryCoords: result.data.geometryCoords,
    totalDistance: result.data.totalDistance,
    totalDuration: result.data.totalDuration,
    finishLeg: null,
  };
}

/** Single-leg Directions call from the last routed point to the fixed finish point. */
async function callFinishLeg(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): Promise<{ ok: true; distance: number; duration: number; geometryCoords: [number, number][] } | { ok: false; reason: string }> {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const result = await fetchDirectionsRoute(coords);
  if (!result.ok) return result;
  return { ok: true, distance: result.data.totalDistance, duration: result.data.totalDuration, geometryCoords: result.data.geometryCoords };
}

function safeParseJson(text: string): { code?: string; message?: string } | null {
  try {
    return JSON.parse(text) as { code?: string; message?: string };
  } catch {
    return null;
  }
}
