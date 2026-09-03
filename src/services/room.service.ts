import type { BathroomType, RoomStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { parseRoomNumberRange, roomStatusButtons, type RoomBulkCreateInput } from "@/validators/room";

// App defaults for the per-property price overrides (HotelProperty.
// priceFullBathGbp / priceShowerOnlyGbp) -- used whenever a property hasn't
// set its own rate. BATH_ONLY has no dedicated price field in the data model
// (the brief only specifies full-bath and shower-only overrides), so it's
// priced the same as a full bath -- comparable scope (bath + surrounding
// seal, no shower enclosure to add) -- rather than inventing a third field.
export const DEFAULT_PRICE_FULL_BATH_GBP = 250;
export const DEFAULT_PRICE_SHOWER_ONLY_GBP = 120;

export type PropertyPricing = { priceFullBathGbp: unknown; priceShowerOnlyGbp: unknown };

/** The effective price (property override, else the app default) for one room's bathroom type. */
export function roomPriceGbp(bathroomType: BathroomType, property: PropertyPricing): number {
  if (bathroomType === "SHOWER_ONLY") {
    return property.priceShowerOnlyGbp != null ? Number(property.priceShowerOnlyGbp) : DEFAULT_PRICE_SHOWER_ONLY_GBP;
  }
  return property.priceFullBathGbp != null ? Number(property.priceFullBathGbp) : DEFAULT_PRICE_FULL_BATH_GBP;
}

export type RoomForSummary = { bathroomType: BathroomType; status: RoomStatus };

export type PropertySummary = {
  totalRooms: number;
  valueCompletedGbp: number;
  valueRemainingGbp: number;
  percentComplete: number;
  counts: { done: number; scheduled: number; snag: number; noAccess: number; notStarted: number };
  needsAttention: number;
};

/**
 * Aggregates a property's rooms into the counts/values every stat row and
 * progress bar in this feature is built from -- the one place that logic
 * lives, so the group index, the group page, and the property page can't
 * drift out of sync with each other. Computed server-side over already-
 * fetched room rows (bathroomType + status only), never by shipping full
 * room records to the client.
 */
export function summarizeRooms(rooms: RoomForSummary[], property: PropertyPricing): PropertySummary {
  let valueCompletedGbp = 0;
  let valueRemainingGbp = 0;
  const counts = { done: 0, scheduled: 0, snag: 0, noAccess: 0, notStarted: 0 };

  for (const room of rooms) {
    const price = roomPriceGbp(room.bathroomType, property);
    if (room.status === "DONE") {
      valueCompletedGbp += price;
      counts.done++;
    } else {
      valueRemainingGbp += price;
      if (room.status === "SCHEDULED") counts.scheduled++;
      else if (room.status === "SNAG") counts.snag++;
      else if (room.status === "NO_ACCESS") counts.noAccess++;
      else counts.notStarted++;
    }
  }

  return {
    totalRooms: rooms.length,
    valueCompletedGbp,
    valueRemainingGbp,
    percentComplete: rooms.length > 0 ? Math.round((counts.done / rooms.length) * 100) : 0,
    counts,
    needsAttention: counts.snag + counts.noAccess,
  };
}

// ---------------------------------------------------------------------------
// Bulk room creation
// ---------------------------------------------------------------------------

export type BulkCreateResult = { created: number; skipped: string[] };

/**
 * Creates one Room per parsed room number, skipping (and reporting) any
 * that already exist on this property rather than failing the whole batch --
 * lets staff re-run a slightly-overlapping range safely. sortIndex continues
 * from the property's current highest, so a second batch (e.g. a "second
 * floor" range added later) appends after the first rather than
 * interleaving.
 */
export async function bulkCreateRooms(propertyId: string, input: RoomBulkCreateInput): Promise<BulkCreateResult> {
  const roomNumbers = parseRoomNumberRange(input.roomNumberRange);

  const existing = await db.room.findMany({
    where: { propertyId, roomNumber: { in: roomNumbers } },
    select: { roomNumber: true },
  });
  const existingSet = new Set(existing.map((r) => r.roomNumber));
  const toCreate = roomNumbers.filter((n) => !existingSet.has(n));
  const skipped = roomNumbers.filter((n) => existingSet.has(n));

  if (toCreate.length === 0) return { created: 0, skipped };

  const maxSort = await db.room.aggregate({ where: { propertyId }, _max: { sortIndex: true } });
  let nextSort = (maxSort._max.sortIndex ?? -1) + 1;

  await db.room.createMany({
    data: toCreate.map((roomNumber) => ({
      propertyId,
      roomNumber,
      floor: input.floor || null,
      bathroomType: input.bathroomType,
      sortIndex: nextSort++,
    })),
  });

  return { created: toCreate.length, skipped };
}

// ---------------------------------------------------------------------------
// Room detail + status/visit mutations
// ---------------------------------------------------------------------------

export type RoomVisitItem = {
  id: string;
  visitDate: Date;
  workType: string;
  linearMetres: unknown;
  priceGbp: unknown;
  sealantBrand: string | null;
  sealantColour: string | null;
  tubesUsed: unknown;
  operative: string | null;
  notes: string | null;
};

export type RoomDetail = {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: string | null;
  bathroomType: BathroomType;
  status: RoomStatus;
  lastCompletedAt: Date | null;
  notes: string | null;
  visits: RoomVisitItem[];
  property: { priceFullBathGbp: unknown; priceShowerOnlyGbp: unknown; resealIntervalMonths: number };
};

export async function getRoomDetail(id: string): Promise<RoomDetail | null> {
  const room = await db.room.findFirst({
    where: { id, deletedAt: null },
    include: {
      visits: { orderBy: { visitDate: "desc" } },
      property: { select: { priceFullBathGbp: true, priceShowerOnlyGbp: true, resealIntervalMonths: true } },
    },
  });
  return room as RoomDetail | null;
}

/**
 * "Done" -- always records a fresh RoomVisit (CUT_OUT_AND_RESEAL, dated
 * today) and updates lastCompletedAt, even if the room is already DONE from
 * an earlier visit. Deliberately never toggles off: a hotel gets resealed
 * repeatedly over its lifetime, and repeated presses must keep accumulating
 * history (verified: pressing Done twice adds two visits, the first left
 * intact) -- the toggle-to-NOT_STARTED behaviour lives only in
 * setRoomStatus below, for the non-history statuses where "undo" is the
 * obviously right affordance.
 */
export async function markRoomDone(roomId: string, priceGbp?: number): Promise<void> {
  const now = new Date();
  await db.$transaction([
    db.roomVisit.create({
      data: { roomId, visitDate: now, workType: "CUT_OUT_AND_RESEAL", priceGbp: priceGbp ?? null },
    }),
    db.room.update({ where: { id: roomId }, data: { status: "DONE", lastCompletedAt: now } }),
  ]);
}

/**
 * The three non-completing status buttons (Scheduled / No access / Snag) --
 * pure status markers, no RoomVisit created. Pressing the room's current
 * status again clears it back to NOT_STARTED, per the room sheet's toggle
 * behaviour. Quick-mark mode (see setRoomStatusDirect) intentionally skips
 * this toggle so a batch "paint" pass over many different rooms always
 * lands on the selected status.
 */
export async function setRoomStatus(roomId: string, status: Exclude<RoomStatus, "DONE">): Promise<void> {
  const room = await db.room.findUniqueOrThrow({ where: { id: roomId }, select: { status: true } });
  const next = room.status === status ? "NOT_STARTED" : status;
  await db.room.update({ where: { id: roomId }, data: { status: next } });
}

/** Quick-mark mode: always sets the given status directly (or records a Done visit), no toggle -- see setRoomStatus for why. */
export async function applyQuickMark(roomId: string, status: (typeof roomStatusButtons)[number]): Promise<void> {
  if (status === "DONE") {
    await markRoomDone(roomId);
    return;
  }
  await db.room.update({ where: { id: roomId }, data: { status } });
}

export type RoomListItem = {
  id: string;
  roomNumber: string;
  floor: string | null;
  bathroomType: BathroomType;
  status: RoomStatus;
  lastCompletedAt: Date | null;
  sortIndex: number;
};

export async function listRoomsForProperty(propertyId: string): Promise<RoomListItem[]> {
  const rows = await db.room.findMany({
    where: { propertyId, deletedAt: null },
    select: { id: true, roomNumber: true, floor: true, bathroomType: true, status: true, lastCompletedAt: true, sortIndex: true },
    orderBy: [{ floor: "asc" }, { sortIndex: "asc" }, { roomNumber: "asc" }],
  });
  return rows as RoomListItem[];
}

/** True if a room's last completing visit has fallen out of the property's reseal cadence -- drives the dashed-border "due" indicator on its tile. */
export function isResealDue(lastCompletedAt: Date | null, resealIntervalMonths: number, now: Date = new Date()): boolean {
  if (!lastCompletedAt) return false;
  const due = new Date(lastCompletedAt);
  due.setMonth(due.getMonth() + resealIntervalMonths);
  return due <= now;
}
