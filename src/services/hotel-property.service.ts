import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { geocodeAddress } from "@/services/geocode.service";
import { summarizeRooms, isResealDue, roomPriceGbp, type PropertySummary } from "@/services/room.service";
import type { HotelPropertyInput } from "@/validators/hotel";

const roomsForSummarySelect = { where: { deletedAt: null }, select: { bathroomType: true, status: true } } as const;

export type PropertyListItem = {
  id: string;
  name: string;
  town: string | null;
  region: string | null;
  summary: PropertySummary;
};

/** Generic grouping helper -- keeps region as just one of several fields the caller can later group by (town, distance, ...) without restructuring the query. */
function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    (result[key] ??= []).push(item);
  }
  return result;
}

const NO_REGION = "Unspecified region";

/**
 * Properties within a group (or the "Independent" bucket when groupId is
 * null), grouped under region subheadings, sorted alphabetically by region
 * then property name -- src/app/(crm)/properties/groups/[id]/page.tsx does
 * the actual grouping via groupBy() below rather than a Prisma-level
 * groupBy, since each row also needs its nested room aggregation (Prisma's
 * groupBy can't mix scalar grouping with relation includes in one query).
 */
export async function listPropertiesByGroup(groupId: string | null): Promise<Record<string, PropertyListItem[]>> {
  const properties = await db.hotelProperty.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, hotelGroupId: groupId },
    select: {
      id: true, name: true, town: true, region: true,
      priceFullBathGbp: true, priceShowerOnlyGbp: true,
      rooms: roomsForSummarySelect,
    },
    orderBy: { name: "asc" },
  });

  const items: PropertyListItem[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    town: p.town,
    region: p.region,
    summary: summarizeRooms(p.rooms, p),
  }));

  const grouped = groupBy(items, (p) => p.region?.trim() || NO_REGION);
  const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  const result: Record<string, PropertyListItem[]> = {};
  for (const key of sortedKeys) {
    result[key] = grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}

export type GroupHeaderStats = { propertyCount: number; totalRooms: number; valueCompletedGbp: number; valueRemainingGbp: number };

export async function getGroupHeaderStats(groupId: string | null): Promise<GroupHeaderStats> {
  const properties = await db.hotelProperty.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, hotelGroupId: groupId },
    select: { priceFullBathGbp: true, priceShowerOnlyGbp: true, rooms: roomsForSummarySelect },
  });

  let totalRooms = 0;
  let valueCompletedGbp = 0;
  let valueRemainingGbp = 0;
  for (const p of properties) {
    const s = summarizeRooms(p.rooms, p);
    totalRooms += s.totalRooms;
    valueCompletedGbp += s.valueCompletedGbp;
    valueRemainingGbp += s.valueRemainingGbp;
  }

  return { propertyCount: properties.length, totalRooms, valueCompletedGbp, valueRemainingGbp };
}

export type PropertyDetail = {
  id: string;
  hotelGroupId: string | null;
  hotelGroup: { id: string; name: string } | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  name: string;
  addressLine1: string;
  town: string | null;
  region: string | null;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  totalBedrooms: number | null;
  siteContactName: string | null;
  siteContactRole: string | null;
  siteContactPhone: string | null;
  siteContactEmail: string | null;
  accessNotes: string | null;
  sealantBrand: string | null;
  sealantColour: string | null;
  sealantTubePriceGbp: unknown;
  priceFullBathGbp: unknown;
  priceShowerOnlyGbp: unknown;
  resealIntervalMonths: number;
  notes: string | null;
};

export async function getProperty(id: string): Promise<PropertyDetail | null> {
  const property = await db.hotelProperty.findFirst({
    where: { id, organisationId: ORG_ID, deletedAt: null },
    include: {
      hotelGroup: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  return property as PropertyDetail | null;
}

/** Property-level stat row (rooms done/total, value done/remaining, attention count) -- same summarizeRooms() every other aggregate uses. */
export async function getPropertySummary(id: string): Promise<PropertySummary> {
  const property = await db.hotelProperty.findUniqueOrThrow({
    where: { id },
    select: { priceFullBathGbp: true, priceShowerOnlyGbp: true, rooms: roomsForSummarySelect },
  });
  return summarizeRooms(property.rooms, property);
}

export async function createHotelProperty(data: HotelPropertyInput) {
  const property = await db.hotelProperty.create({
    data: {
      organisationId: ORG_ID,
      hotelGroupId: data.hotelGroupId || null,
      customerId: data.customerId || null,
      name: data.name,
      addressLine1: data.addressLine1,
      town: data.town || null,
      region: data.region || null,
      postcode: data.postcode,
      totalBedrooms: data.totalBedrooms ?? null,
      siteContactName: data.siteContactName || null,
      siteContactRole: data.siteContactRole || null,
      siteContactPhone: data.siteContactPhone || null,
      siteContactEmail: data.siteContactEmail || null,
      accessNotes: data.accessNotes || null,
      sealantBrand: data.sealantBrand || null,
      sealantColour: data.sealantColour || null,
      sealantTubePriceGbp: data.sealantTubePriceGbp ?? null,
      priceFullBathGbp: data.priceFullBathGbp ?? null,
      priceShowerOnlyGbp: data.priceShowerOnlyGbp ?? null,
      resealIntervalMonths: data.resealIntervalMonths,
      notes: data.notes || null,
    },
  });
  await ensureHotelPropertyGeocoded(property.id).catch(() => {});
  return property;
}

export async function updateHotelProperty(id: string, data: HotelPropertyInput) {
  const property = await db.hotelProperty.update({
    where: { id },
    data: {
      hotelGroupId: data.hotelGroupId || null,
      customerId: data.customerId || null,
      name: data.name,
      addressLine1: data.addressLine1,
      town: data.town || null,
      region: data.region || null,
      postcode: data.postcode,
      totalBedrooms: data.totalBedrooms ?? null,
      siteContactName: data.siteContactName || null,
      siteContactRole: data.siteContactRole || null,
      siteContactPhone: data.siteContactPhone || null,
      siteContactEmail: data.siteContactEmail || null,
      accessNotes: data.accessNotes || null,
      sealantBrand: data.sealantBrand || null,
      sealantColour: data.sealantColour || null,
      sealantTubePriceGbp: data.sealantTubePriceGbp ?? null,
      priceFullBathGbp: data.priceFullBathGbp ?? null,
      priceShowerOnlyGbp: data.priceShowerOnlyGbp ?? null,
      resealIntervalMonths: data.resealIntervalMonths,
      notes: data.notes || null,
      // Address may have changed -- clear the cached geocode so
      // ensureHotelPropertyGeocoded re-looks-up rather than keeping a pin
      // for the old address.
      latitude: null,
      longitude: null,
    },
  });
  await ensureHotelPropertyGeocoded(property.id).catch(() => {});
  return property;
}

/**
 * Soft-delete -- mirrors softDeleteProperty (the existing job-site Property
 * model). Never cascades: rooms and their works history survive untouched,
 * only the property's own visibility is hidden. Callers are responsible for
 * the permission check.
 */
export async function softDeleteHotelProperty(id: string, userId: string | null): Promise<void> {
  await db.hotelProperty.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } });
}

export async function restoreHotelProperty(id: string): Promise<void> {
  await db.hotelProperty.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
}

/** Same lazy-geocode-once pattern as ensurePropertyGeocoded in map.service.ts, for the existing Property model. */
export async function ensureHotelPropertyGeocoded(propertyId: string): Promise<{ latitude: number; longitude: number } | null> {
  const property = await db.hotelProperty.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  if (property.latitude != null && property.longitude != null) {
    return { latitude: property.latitude, longitude: property.longitude };
  }

  const address = [property.addressLine1, property.town, property.postcode, "UK"].filter(Boolean).join(", ");
  const geocoded = await geocodeAddress(address);
  if (!geocoded) return null;

  await db.hotelProperty.update({ where: { id: propertyId }, data: { latitude: geocoded.latitude, longitude: geocoded.longitude } });
  return geocoded;
}

// ---------------------------------------------------------------------------
// Reseal-due list
// ---------------------------------------------------------------------------

export type ResealDueRow = {
  propertyId: string;
  propertyName: string;
  groupName: string | null;
  town: string | null;
  oldestCompletedAt: Date;
  dueRoomCount: number;
  estimatedValueGbp: number;
  siteContactName: string | null;
  siteContactPhone: string | null;
  siteContactEmail: string | null;
};

/**
 * intervalMonthsOverride, when given (36/48/60 from the page's filter),
 * applies that fixed cadence to every property uniformly. Left undefined,
 * each property's own resealIntervalMonths is used -- the more accurate
 * "due against what we're actually contracted to" default view. Either way
 * this can't be expressed as a single Prisma `where` (the cutoff depends on
 * a per-row field), so it fetches every room with a completion date and
 * filters/groups here -- fine at this business's scale (hundreds, not
 * millions, of tracked bathrooms).
 */
export async function listResealDue(intervalMonthsOverride?: number): Promise<ResealDueRow[]> {
  const properties = await db.hotelProperty.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    select: {
      id: true, name: true, town: true, resealIntervalMonths: true,
      priceFullBathGbp: true, priceShowerOnlyGbp: true,
      siteContactName: true, siteContactPhone: true, siteContactEmail: true,
      hotelGroup: { select: { name: true } },
      rooms: {
        where: { deletedAt: null, lastCompletedAt: { not: null } },
        select: { bathroomType: true, lastCompletedAt: true },
      },
    },
  });

  const now = new Date();
  const rows: ResealDueRow[] = [];

  for (const property of properties) {
    const months = intervalMonthsOverride ?? property.resealIntervalMonths;
    const dueRooms = property.rooms.filter((r) => isResealDue(r.lastCompletedAt, months, now));
    if (dueRooms.length === 0) continue;

    const oldestCompletedAt = dueRooms.reduce<Date>(
      (oldest, r) => (r.lastCompletedAt! < oldest ? r.lastCompletedAt! : oldest),
      dueRooms[0].lastCompletedAt!
    );
    const estimatedValueGbp = dueRooms.reduce((sum, r) => sum + roomPriceGbp(r.bathroomType, property), 0);

    rows.push({
      propertyId: property.id,
      propertyName: property.name,
      groupName: property.hotelGroup?.name ?? null,
      town: property.town,
      oldestCompletedAt,
      dueRoomCount: dueRooms.length,
      estimatedValueGbp,
      siteContactName: property.siteContactName,
      siteContactPhone: property.siteContactPhone,
      siteContactEmail: property.siteContactEmail,
    });
  }

  return rows.sort((a, b) => a.oldestCompletedAt.getTime() - b.oldestCompletedAt.getTime());
}
