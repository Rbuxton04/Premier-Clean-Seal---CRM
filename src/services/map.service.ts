import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { geocodeAddress } from "@/services/geocode.service";

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts.
export type MapJobItem = {
  id: string;
  jobNumber: string;
  status: string;
  scheduledStart: Date | null;
  customer: { id: string; name: string };
  property: {
    id: string;
    addressLine1: string;
    city: string | null;
    postcode: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  technician: { id: string; name: string } | null;
};

function dayRange(dateISO: string): { start: Date; end: Date } {
  const start = new Date(dateISO);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function listJobsForMap(dateISO: string, technicianId?: string): Promise<MapJobItem[]> {
  const { start, end } = dayRange(dateISO);
  const rows = await db.job.findMany({
    where: {
      organisationId: ORG_ID,
      status: { not: "CANCELLED" },
      scheduledStart: { gte: start, lt: end },
      ...(technicianId ? { technicianId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      property: { select: { id: true, addressLine1: true, city: true, postcode: true, latitude: true, longitude: true } },
      technician: { select: { id: true, name: true } },
    },
    orderBy: { scheduledStart: "asc" },
  });
  return rows as MapJobItem[];
}

/**
 * Returns a property's cached lat/lng, geocoding and persisting it on demand
 * if it hasn't been looked up before. This is the only place a Property
 * should ever be geocoded — every other caller goes through here so an
 * address is never charged against the Mapbox free tier more than once.
 */
export async function ensurePropertyGeocoded(propertyId: string): Promise<{ latitude: number; longitude: number } | null> {
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  if (property.latitude != null && property.longitude != null) {
    return { latitude: property.latitude, longitude: property.longitude };
  }

  const address = [property.addressLine1, property.city, property.postcode, "UK"].filter(Boolean).join(", ");
  const geocoded = await geocodeAddress(address);
  if (!geocoded) return null;

  await db.property.update({
    where: { id: propertyId },
    data: { latitude: geocoded.latitude, longitude: geocoded.longitude },
  });
  return geocoded;
}
