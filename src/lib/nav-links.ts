export type NavPoint = { latitude: number; longitude: number };

/**
 * Google Maps' universal deep link honours ordered waypoints reliably up to
 * roughly 9-10 stops without an API key. Our optimisation batches already
 * cap at 11 stops per leg, which is in the same ballpark — for longer days
 * "navigate to next stop only" (buildGoogleMapsSingleStopUrl) is the more
 * reliable fallback, offered alongside this in the UI.
 */
export function buildGoogleMapsMultiStopUrl(origin: NavPoint, stops: NavPoint[]): string {
  if (stops.length === 0) return "";
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map((w) => `${w.latitude},${w.longitude}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsSingleStopUrl(destination: NavPoint): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildAppleMapsSingleStopUrl(destination: NavPoint): string {
  return `https://maps.apple.com/?daddr=${destination.latitude},${destination.longitude}&dirflg=d`;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
