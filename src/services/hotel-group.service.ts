import type { BathroomType, RoomStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { summarizeRooms, type PropertySummary } from "@/services/room.service";
import type { HotelGroupInput } from "@/validators/hotel";

type PropertyForSummary = { priceFullBathGbp: unknown; priceShowerOnlyGbp: unknown; rooms: Array<{ bathroomType: BathroomType; status: RoomStatus }> };

// Shared select shape for the room-level fields the aggregation needs --
// used by both the real groups and the synthetic "Independent" bucket below.
const roomsForSummarySelect = {
  where: { deletedAt: null },
  select: { bathroomType: true, status: true },
} as const;

export type GroupSummary = {
  /** null identifies the synthetic "Independent" bucket -- properties with no HotelGroup. */
  id: string | null;
  name: string;
  propertyCount: number;
  summary: PropertySummary;
};

/**
 * One row per HotelGroup plus a trailing "Independent" bucket aggregating
 * every ungrouped property -- the /properties index. Aggregation (counts,
 * value totals, percentages) happens here over already-fetched bathroomType/
 * status pairs, never by shipping room rows to the client.
 */
export async function listGroupSummaries(): Promise<GroupSummary[]> {
  const groups = await db.hotelGroup.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    include: {
      properties: {
        where: { deletedAt: null },
        select: { priceFullBathGbp: true, priceShowerOnlyGbp: true, rooms: roomsForSummarySelect },
      },
    },
    orderBy: { name: "asc" },
  });

  const independentProperties = await db.hotelProperty.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, hotelGroupId: null },
    select: { priceFullBathGbp: true, priceShowerOnlyGbp: true, rooms: roomsForSummarySelect },
  });

  function summarizeGroupProperties(properties: PropertyForSummary[]): PropertySummary {
    const allRooms = properties.flatMap((p) => p.rooms.map((r) => ({ ...r, property: p })));
    // Each room needs ITS OWN property's price override, not one shared
    // price -- summarizeRooms takes a single property, so fold room-by-room
    // instead of calling it once per group.
    let valueCompletedGbp = 0;
    let valueRemainingGbp = 0;
    const counts = { done: 0, scheduled: 0, snag: 0, noAccess: 0, notStarted: 0 };
    for (const room of allRooms) {
      const single = summarizeRooms([room], room.property);
      valueCompletedGbp += single.valueCompletedGbp;
      valueRemainingGbp += single.valueRemainingGbp;
      counts.done += single.counts.done;
      counts.scheduled += single.counts.scheduled;
      counts.snag += single.counts.snag;
      counts.noAccess += single.counts.noAccess;
      counts.notStarted += single.counts.notStarted;
    }
    return {
      totalRooms: allRooms.length,
      valueCompletedGbp,
      valueRemainingGbp,
      percentComplete: allRooms.length > 0 ? Math.round((counts.done / allRooms.length) * 100) : 0,
      counts,
      needsAttention: counts.snag + counts.noAccess,
    };
  }

  const result: GroupSummary[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    propertyCount: g.properties.length,
    summary: summarizeGroupProperties(g.properties),
  }));

  if (independentProperties.length > 0) {
    result.push({
      id: null,
      name: "Independent",
      propertyCount: independentProperties.length,
      summary: summarizeGroupProperties(independentProperties),
    });
  }

  return result;
}

export type HotelGroupOption = { id: string; name: string };

export async function listHotelGroupOptions(): Promise<HotelGroupOption[]> {
  const rows = await db.hotelGroup.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

export async function getHotelGroup(id: string): Promise<{ id: string; name: string } | null> {
  return db.hotelGroup.findFirst({ where: { id, organisationId: ORG_ID, deletedAt: null }, select: { id: true, name: true } });
}

export async function createHotelGroup(data: HotelGroupInput) {
  return db.hotelGroup.create({
    data: {
      organisationId: ORG_ID,
      name: data.name,
      contactName: data.contactName || null,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      notes: data.notes || null,
    },
  });
}

export async function updateHotelGroup(id: string, data: HotelGroupInput) {
  return db.hotelGroup.update({
    where: { id },
    data: {
      name: data.name,
      contactName: data.contactName || null,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      notes: data.notes || null,
    },
  });
}

/**
 * Soft-delete -- mirrors softDeleteCustomer/softDeleteJob. Never cascades:
 * the group's properties survive untouched and simply fall back into the
 * "Independent" bucket on the index page once the group stops matching any
 * deletedAt: null query. Callers are responsible for the permission check.
 */
export async function softDeleteHotelGroup(id: string, userId: string | null): Promise<void> {
  await db.hotelGroup.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } });
}

export async function restoreHotelGroup(id: string): Promise<void> {
  await db.hotelGroup.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
}
