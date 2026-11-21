import type { TakeoffItemKind } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import type { TakeoffItemPresetInput } from "@/validators/takeoff";
import type { TakeoffItemDetail } from "@/services/takeoff.service";

// Explicit hand-written return types -- see the Prisma typing note in customer.service.ts.
export type RateCardItem = {
  id: string;
  name: string;
  colour: string;
  kind: TakeoffItemKind;
  pricePerMetre: unknown;
  sortOrder: number;
  overrideJointWidthMm: number | null;
  overrideJointDepthMm: number | null;
  overrideWastePercent: number | null;
};

const RATE_CARD_SELECT = {
  id: true, name: true, colour: true, kind: true, pricePerMetre: true, sortOrder: true,
  overrideJointWidthMm: true, overrideJointDepthMm: true, overrideWastePercent: true,
} as const;

export async function listRateCardItems(): Promise<RateCardItem[]> {
  return db.takeoffItemPreset.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    select: RATE_CARD_SELECT,
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
    data: {
      organisationId: ORG_ID, name: data.name, colour: data.colour, kind: data.kind, pricePerMetre: data.pricePerMetre,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      overrideJointWidthMm: data.overrideJointWidthMm ?? null,
      overrideJointDepthMm: data.overrideJointDepthMm ?? null,
      overrideWastePercent: data.overrideWastePercent ?? null,
    },
    select: { id: true },
  });
}

export async function updateRateCardItem(id: string, data: TakeoffItemPresetInput): Promise<void> {
  await assertNameAvailable(data.name, id);
  await db.takeoffItemPreset.update({
    where: { id },
    data: {
      name: data.name, colour: data.colour, kind: data.kind, pricePerMetre: data.pricePerMetre,
      overrideJointWidthMm: data.overrideJointWidthMm ?? null,
      overrideJointDepthMm: data.overrideJointDepthMm ?? null,
      overrideWastePercent: data.overrideWastePercent ?? null,
    },
  });
}

/**
 * Swaps sortOrder with the immediate neighbour in the given direction --
 * simple up/down reordering rather than a full drag-and-drop list, which
 * the brief's "reorder" requirement doesn't specifically call for.
 */
/**
 * Swaps sortOrder with the nearest neighbour OF THE SAME KIND -- the
 * rate-card page shows LENGTH and COUNT items as two separate groups
 * (Drawings Part 3), so reordering has to stay within a row's own group
 * rather than swap across into the other one just because sortOrder
 * happens to interleave them.
 */
export async function moveRateCardItem(id: string, direction: "up" | "down"): Promise<void> {
  const all = await listRateCardItems();
  const row = all.find((i) => i.id === id);
  if (!row) return;
  const group = all.filter((i) => i.kind === row.kind);
  const index = group.findIndex((i) => i.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= group.length) return;

  await db.$transaction([
    db.takeoffItemPreset.update({ where: { id: group[index].id }, data: { sortOrder: group[swapIndex].sortOrder } }),
    db.takeoffItemPreset.update({ where: { id: group[swapIndex].id }, data: { sortOrder: group[index].sortOrder } }),
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
export type UpsertPresetInput = {
  kind: TakeoffItemKind;
  overrideJointWidthMm?: number | null;
  overrideJointDepthMm?: number | null;
  overrideWastePercent?: number | null;
};

export async function upsertRateCardItemByName(
  name: string,
  colour: string,
  pricePerMetre: number,
  extra: UpsertPresetInput
): Promise<{ id: string; created: boolean }> {
  const data = {
    colour, pricePerMetre, kind: extra.kind,
    overrideJointWidthMm: extra.overrideJointWidthMm ?? null,
    overrideJointDepthMm: extra.overrideJointDepthMm ?? null,
    overrideWastePercent: extra.overrideWastePercent ?? null,
  };
  const existing = await db.takeoffItemPreset.findFirst({ where: { organisationId: ORG_ID, deletedAt: null, name }, select: { id: true } });
  if (existing) {
    await db.takeoffItemPreset.update({ where: { id: existing.id }, data });
    return { id: existing.id, created: false };
  }
  const maxSort = await db.takeoffItemPreset.aggregate({ where: { organisationId: ORG_ID }, _max: { sortOrder: true } });
  const created = await db.takeoffItemPreset.create({
    data: { organisationId: ORG_ID, name, sortOrder: (maxSort._max.sortOrder ?? -1) + 1, ...data },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

// ---------------------------------------------------------------------------
// Applying rate card items to a takeoff
// ---------------------------------------------------------------------------

export type AddedRateCardItem = {
  id: string; name: string; colour: string; kind: TakeoffItemKind; pricePerMetre: unknown; sortOrder: number;
  overrideJointWidthMm: number | null; overrideJointDepthMm: number | null; overrideWastePercent: number | null;
};

/**
 * "Add all from rate card" -- creates a TakeoffItem for every non-deleted
 * rate card row not already on this takeoff, matched by name. Existing
 * items (and anything already measured) are untouched. Individual
 * create() calls (not createMany) so each new row's id comes back and the
 * client can append them locally without a full reload, same as a single
 * "Add item". Copies kind and any joint overrides too (Drawings Part 3) --
 * a snapshot, same as colour/price: editing the preset afterwards never
 * touches this TakeoffItem.
 */
export async function addAllRateCardItemsToTakeoff(takeoffId: string, existingItems: TakeoffItemDetail[]): Promise<AddedRateCardItem[]> {
  const presets = await listRateCardItems();
  const existingNames = new Set(existingItems.map((i) => i.name));
  const toAdd = presets.filter((p) => !existingNames.has(p.name));

  let nextSort = existingItems.length;
  const created: AddedRateCardItem[] = [];
  for (const p of toAdd) {
    const row = await db.takeoffItem.create({
      data: {
        takeoffId, name: p.name, colour: p.colour, kind: p.kind, pricePerMetre: Number(p.pricePerMetre), sortOrder: nextSort++,
        overrideJointWidthMm: p.overrideJointWidthMm, overrideJointDepthMm: p.overrideJointDepthMm, overrideWastePercent: p.overrideWastePercent,
      },
      select: {
        id: true, name: true, colour: true, kind: true, pricePerMetre: true, sortOrder: true,
        overrideJointWidthMm: true, overrideJointDepthMm: true, overrideWastePercent: true,
      },
    });
    created.push(row);
  }
  return created;
}
