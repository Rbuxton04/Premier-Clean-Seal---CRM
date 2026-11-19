import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import type { TakeoffItemPresetInput } from "@/validators/takeoff";
import type { TakeoffItemDetail } from "@/services/takeoff.service";

// Explicit hand-written return types -- see the Prisma typing note in customer.service.ts.
export type RateCardItem = { id: string; name: string; colour: string; pricePerMetre: unknown; sortOrder: number };

export async function listRateCardItems(): Promise<RateCardItem[]> {
  return db.takeoffItemPreset.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    select: { id: true, name: true, colour: true, pricePerMetre: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
}

export class DuplicatePresetNameError extends Error {
  constructor(name: string) {
    super(`A rate card item named "${name}" already exists.`);
  }
}

/**
 * Enforces name-uniqueness among non-deleted rows in the service, not as a
 * DB constraint -- see the schema comment on TakeoffItemPreset for why.
 * excludeId lets updateRateCardItem check "any OTHER row", not itself.
 */
async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
  const existing = await db.takeoffItemPreset.findFirst({
    where: { organisationId: ORG_ID, deletedAt: null, name, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new DuplicatePresetNameError(name);
}

export async function createRateCardItem(data: TakeoffItemPresetInput): Promise<{ id: string }> {
  await assertNameAvailable(data.name);
  const maxSort = await db.takeoffItemPreset.aggregate({ where: { organisationId: ORG_ID }, _max: { sortOrder: true } });
  return db.takeoffItemPreset.create({
    data: { organisationId: ORG_ID, name: data.name, colour: data.colour, pricePerMetre: data.pricePerMetre, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
}

export async function updateRateCardItem(id: string, data: TakeoffItemPresetInput): Promise<void> {
  await assertNameAvailable(data.name, id);
  await db.takeoffItemPreset.update({ where: { id }, data: { name: data.name, colour: data.colour, pricePerMetre: data.pricePerMetre } });
}

/**
 * Swaps sortOrder with the immediate neighbour in the given direction --
 * simple up/down reordering rather than a full drag-and-drop list, which
 * the brief's "reorder" requirement doesn't specifically call for.
 */
export async function moveRateCardItem(id: string, direction: "up" | "down"): Promise<void> {
  const items = await listRateCardItems();
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= items.length) return;

  await db.$transaction([
    db.takeoffItemPreset.update({ where: { id: items[index].id }, data: { sortOrder: items[swapIndex].sortOrder } }),
    db.takeoffItemPreset.update({ where: { id: items[swapIndex].id }, data: { sortOrder: items[index].sortOrder } }),
  ]);
}

export async function softDeleteRateCardItem(id: string, userId: string | null): Promise<void> {
  await db.takeoffItemPreset.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } });
}

export async function restoreRateCardItem(id: string): Promise<void> {
  await db.takeoffItemPreset.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
}

/**
 * "Save to rate card" on a custom item -- creates a new preset, or updates
 * the existing one with the same name if there already is one (the brief's
 * "or offers to update the existing preset with that name"). Returns which
 * happened so the caller can message it appropriately.
 */
export async function upsertRateCardItemByName(name: string, colour: string, pricePerMetre: number): Promise<{ id: string; created: boolean }> {
  const existing = await db.takeoffItemPreset.findFirst({ where: { organisationId: ORG_ID, deletedAt: null, name }, select: { id: true } });
  if (existing) {
    await db.takeoffItemPreset.update({ where: { id: existing.id }, data: { colour, pricePerMetre } });
    return { id: existing.id, created: false };
  }
  const maxSort = await db.takeoffItemPreset.aggregate({ where: { organisationId: ORG_ID }, _max: { sortOrder: true } });
  const created = await db.takeoffItemPreset.create({
    data: { organisationId: ORG_ID, name, colour, pricePerMetre, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

// ---------------------------------------------------------------------------
// Applying rate card items to a takeoff
// ---------------------------------------------------------------------------

export type AddedRateCardItem = { id: string; name: string; colour: string; pricePerMetre: unknown; sortOrder: number };

/**
 * "Add all from rate card" -- creates a TakeoffItem for every non-deleted
 * rate card row not already on this takeoff, matched by name. Existing
 * items (and anything already measured) are untouched. Individual
 * create() calls (not createMany) so each new row's id comes back and the
 * client can append them locally without a full reload, same as a single
 * "Add item".
 */
export async function addAllRateCardItemsToTakeoff(takeoffId: string, existingItems: TakeoffItemDetail[]): Promise<AddedRateCardItem[]> {
  const presets = await listRateCardItems();
  const existingNames = new Set(existingItems.map((i) => i.name));
  const toAdd = presets.filter((p) => !existingNames.has(p.name));

  let nextSort = existingItems.length;
  const created: AddedRateCardItem[] = [];
  for (const p of toAdd) {
    const row = await db.takeoffItem.create({
      data: { takeoffId, name: p.name, colour: p.colour, pricePerMetre: Number(p.pricePerMetre), sortOrder: nextSort++ },
      select: { id: true, name: true, colour: true, pricePerMetre: true, sortOrder: true },
    });
    created.push(row);
  }
  return created;
}
