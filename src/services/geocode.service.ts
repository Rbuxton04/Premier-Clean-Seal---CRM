const MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

// Great Britain bounding box (minLon,minLat,maxLon,maxLat) — passed as Mapbox's
// `bbox` param so a match can never land outside the country, and reused
// below to sanity-check cached coordinates. Deliberately generous (covers
// Scotland/NI too) rather than tight, since it only needs to rule out
// obviously-wrong matches like a same-named street abroad.
export const GB_BOUNDS = { minLat: 49.82, maxLat: 60.85, minLng: -8.65, maxLng: 1.78 };

/** True when a coordinate pair falls inside Great Britain's bounding box. */
export function isWithinGB(latitude: number, longitude: number): boolean {
  return (
    latitude >= GB_BOUNDS.minLat &&
    latitude <= GB_BOUNDS.maxLat &&
    longitude >= GB_BOUNDS.minLng &&
    longitude <= GB_BOUNDS.maxLng
  );
}

// Nearly all jobs are within a few miles of Leigh, Greater Manchester —
// biasing the geocoder here resolves ambiguous local names (a street/place
// name that also exists elsewhere in the UK) to the right one.
const LEIGH_PROXIMITY = "-2.5178,53.4975";

// Below this Mapbox relevance score (0-1) a match is too uncertain to trust —
// better to report "couldn't locate" and leave the property ungeocoded than
// cache a wrong pin.
const MIN_RELEVANCE = 0.5;

/** Server-side Mapbox capability check — never expose MAPBOX_SECRET_TOKEN to the browser. */
export function isMapboxServerConfigured(): boolean {
  return Boolean(process.env.MAPBOX_SECRET_TOKEN);
}

export type GeocodeResult = { latitude: number; longitude: number };

/**
 * Forward-geocodes a UK address via the Mapbox Geocoding API. Returns null
 * (never throws) when the secret token is missing, the request fails, no
 * match is found, or the best match is too low-confidence to trust —
 * callers should treat that as "couldn't place this on the map" rather than
 * a hard error. Callers are responsible for caching the result (see
 * ensurePropertyGeocoded in map.service.ts) so an address is only ever
 * geocoded once.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) return null;

  const bbox = `${GB_BOUNDS.minLng},${GB_BOUNDS.minLat},${GB_BOUNDS.maxLng},${GB_BOUNDS.maxLat}`;
  const params = new URLSearchParams({
    country: "GB",
    bbox,
    proximity: LEIGH_PROXIMITY,
    // The address passed in is already a complete, known-good line (street +
    // postcode) rather than partial user typing, so autocomplete's
    // as-you-type widening only risks pulling in a worse match.
    autocomplete: "false",
    limit: "1",
    access_token: token,
  });
  const url = `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(address)}.json?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Mapbox geocoding failed (HTTP ${res.status}) for "${address}": ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number]; relevance?: number; place_name?: string }>;
    };
    const feature = data.features?.[0];
    const center = feature?.center;
    if (!center) return null;
    if (feature.relevance != null && feature.relevance < MIN_RELEVANCE) {
      console.warn(
        `Mapbox geocoding: low-confidence match (relevance ${feature.relevance}) for "${address}" -> "${feature.place_name}" — discarding rather than caching a possibly-wrong pin.`
      );
      return null;
    }
    const [longitude, latitude] = center;
    return { latitude, longitude };
  } catch (err) {
    console.error(`Mapbox geocoding request threw for "${address}":`, err);
    return null;
  }
}
