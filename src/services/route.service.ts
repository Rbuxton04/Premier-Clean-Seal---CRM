import { isMapboxServerConfigured } from "@/services/geocode.service";
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

  const optimized = await planOptimizedRoute(origin, stopCandidates);
  if (!optimized) {
    return scheduledOrderFallback(
      stopCandidates,
      origin,
      unroutedJobIds,
      "Route optimisation is temporarily unavailable — showing jobs in scheduled order."
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

type OptimizeBatchResult = {
  orderedStops: StopCandidate[];
  legs: Array<{ distance: number; duration: number }>;
  geometryCoords: [number, number][];
  totalDistance: number;
  totalDuration: number;
};

async function planOptimizedRoute(
  origin: { latitude: number; longitude: number },
  stops: StopCandidate[]
): Promise<OptimizeBatchResult | null> {
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
    if (!result) return null;
    orderedStops.push(...result.orderedStops);
    legs.push(...result.legs);
    geometryCoords.push(...result.geometryCoords);
    totalDistance += result.totalDistance;
    totalDuration += result.totalDuration;
    const last = result.orderedStops[result.orderedStops.length - 1];
    currentOrigin = { latitude: last.latitude, longitude: last.longitude };
  }

  return { orderedStops, legs, geometryCoords, totalDistance, totalDuration };
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
): Promise<OptimizeBatchResult | null> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) return null;

  const coords = [origin, ...stops].map((p) => `${p.longitude},${p.latitude}`).join(";");
  const url =
    `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&roundtrip=false&source=first&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      trips?: Array<{
        geometry: { coordinates: [number, number][] };
        legs: Array<{ distance: number; duration: number }>;
        distance: number;
        duration: number;
      }>;
      waypoints?: Array<{ waypoint_index: number }>;
    };
    if (data.code !== "Ok" || !data.trips?.[0] || !data.waypoints) return null;

    const trip = data.trips[0];
    // waypoints[0] is the origin (forced first); waypoints[1..] align by
    // input order with `stops` — each carries the stop's position in the
    // optimised visiting order.
    const stopWaypoints = data.waypoints.slice(1);
    if (stopWaypoints.length !== stops.length) return null;

    const orderedStops = stops
      .map((stop, i) => ({ stop, visitIndex: stopWaypoints[i].waypoint_index }))
      .sort((a, b) => a.visitIndex - b.visitIndex)
      .map(({ stop }) => stop);

    return {
      orderedStops,
      legs: trip.legs,
      geometryCoords: trip.geometry.coordinates,
      totalDistance: trip.distance,
      totalDuration: trip.duration,
    };
  } catch {
    return null;
  }
}
