const MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

/** Server-side Mapbox capability check — never expose MAPBOX_SECRET_TOKEN to the browser. */
export function isMapboxServerConfigured(): boolean {
  return Boolean(process.env.MAPBOX_SECRET_TOKEN);
}

export type GeocodeResult = { latitude: number; longitude: number };

/**
 * Forward-geocodes a UK address via the Mapbox Geocoding API. Returns null
 * (never throws) when the secret token is missing, the request fails, or no
 * match is found — callers should treat that as "couldn't place this on the
 * map" rather than a hard error. Callers are responsible for caching the
 * result (see ensurePropertyGeocoded in map.service.ts) so an address is
 * only ever geocoded once.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) return null;

  const url = `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(address)}.json?country=GB&limit=1&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: Array<{ center?: [number, number] }> };
    const center = data.features?.[0]?.center;
    if (!center) return null;
    const [longitude, latitude] = center;
    return { latitude, longitude };
  } catch {
    return null;
  }
}
