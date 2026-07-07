// `address` is the full postal address (including postcode) for a stop, when
// known — see formatAddress in route.service.ts, the single source of truth
// also used for the on-screen stop list. latitude/longitude are the
// coordinate fallback for a point with no usable address (e.g. a manually
// dropped origin pin).
export type NavPoint = { latitude: number; longitude: number; address?: string };

/**
 * Prefer the full postal address over raw coordinates: Google/Apple Maps
 * reverse-geocode a bare lat/lng themselves, which can resolve to a
 * neighbouring house number on a street of closely-spaced properties — the
 * exact bug this avoids. Coordinates are only used when a stop genuinely has
 * no address text.
 */
function pointToParam(point: NavPoint): string {
  return point.address && point.address.trim().length > 0 ? point.address : `${point.latitude},${point.longitude}`;
}

/**
 * Google Maps' universal deep link honours ordered waypoints reliably up to
 * roughly 9-10 stops without an API key. Our routing batches already cap at
 * 24 stops per leg, well above that — for longer days "navigate to next
 * stop only" (buildGoogleMapsSingleStopUrl) is the more reliable fallback,
 * offered alongside this in the UI.
 */
export function buildGoogleMapsMultiStopUrl(origin: NavPoint, stops: NavPoint[]): string {
  if (stops.length === 0) return "";
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: pointToParam(origin),
    destination: pointToParam(destination),
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map(pointToParam).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsSingleStopUrl(destination: NavPoint): string {
  const params = new URLSearchParams({
    api: "1",
    destination: pointToParam(destination),
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildAppleMapsSingleStopUrl(destination: NavPoint): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(pointToParam(destination))}&dirflg=d`;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
