"use server";

import { revalidatePath } from "next/cache";
import {
  takeoffCreateSchema, takeoffItemSchema, takeoffMeasurementSchema, takeoffScaleSchema, scalePresetSchema, takeoffItemPresetSchema,
  takeoffFileCreateSchema, takeoffFileRenameSchema,
  type TakeoffCreateInput, type TakeoffItemInput, type TakeoffMeasurementInput, type TakeoffScaleInput, type ScalePresetInput, type TakeoffItemPresetInput,
  type TakeoffFileCreateInput, type TakeoffFileRenameInput,
} from "@/validators/takeoff";
import * as TakeoffService from "@/services/takeoff.service";
import * as ScalePresetService from "@/services/scale-preset.service";
import * as RateCardService from "@/services/takeoff-rate-card.service";
import { requirePermission, requireAdmin, ForbiddenError } from "@/lib/permissions";
import { actorContext, writeAudit } from "@/lib/audit";
import type { RecordActionResult } from "@/components/record-action-button";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

function fail(err: unknown): { ok: false; message: string } {
  if (err instanceof ForbiddenError) return { ok: false, message: err.message };
  return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
}

export async function createTakeoffAction(input: TakeoffCreateInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("takeoffs", "create");
    const parsed = takeoffCreateSchema.parse(input);
    const takeoff = await TakeoffService.createTakeoff(parsed);
    const { userId, ip } = await actorContext();
    await writeAudit({ userId, action: "CREATE", resource: "takeoff", resourceId: takeoff.id, after: { name: parsed.name }, ip });
    revalidatePath("/drawings");
    return { ok: true, data: takeoff };
  } catch (err) {
    return fail(err);
  }
}

export async function updateTakeoffScaleAction(takeoffId: string, scale: TakeoffScaleInput): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    const parsed = takeoffScaleSchema.parse(scale);
    await TakeoffService.updateTakeoffScale(takeoffId, parsed);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function updateTakeoffDetailsAction(
  takeoffId: string,
  data: { name?: string; customerId?: string | null; jobId?: string | null; quoteId?: string | null }
): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.updateTakeoffDetails(takeoffId, data);
    revalidatePath(`/drawings/${takeoffId}`);
    revalidatePath("/drawings");
    revalidatePath("/documents");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

/** Admin-only, confirmed client-side -- matches the real delete convention for Job/Customer/Certification/Product (requireAdmin(), not just the Permission table). */
export async function deleteTakeoffAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    await TakeoffService.softDeleteTakeoff(id, actor.id);
    const { userId, ip } = await actorContext();
    await writeAudit({ userId, action: "DELETE", resource: "takeoff", resourceId: id, ip });
    revalidatePath("/drawings");
    revalidatePath("/documents");
    return { ok: true, message: "Deleted" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function createTakeoffItemAction(takeoffId: string, input: TakeoffItemInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("takeoffs", "update");
    const parsed = takeoffItemSchema.parse(input);
    const item = await TakeoffService.createTakeoffItem(takeoffId, parsed);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: item };
  } catch (err) {
    return fail(err);
  }
}

export async function updateTakeoffItemAction(takeoffId: string, itemId: string, input: TakeoffItemInput): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    const parsed = takeoffItemSchema.parse(input);
    await TakeoffService.updateTakeoffItem(itemId, parsed);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteTakeoffItemAction(takeoffId: string, itemId: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.deleteTakeoffItem(itemId);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

export async function createMeasurementAction(
  takeoffId: string,
  input: TakeoffMeasurementInput,
  pointsPerMetre: number
): Promise<ActionResult<{ id: string; computedMetres: number }>> {
  try {
    await requirePermission("takeoffs", "update");
    const parsed = takeoffMeasurementSchema.parse(input);
    const result = await TakeoffService.createMeasurement(parsed, pointsPerMetre);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function updateMeasurementLabelAction(takeoffId: string, measurementId: string, label: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.updateMeasurementLabel(measurementId, label || null);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteMeasurementAction(takeoffId: string, measurementId: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.deleteMeasurement(measurementId);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function clearAllMeasurementsAction(takeoffId: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.clearAllMeasurements(takeoffId);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Scale presets
// ---------------------------------------------------------------------------

export async function createScalePresetAction(input: ScalePresetInput): Promise<ActionResult<{ id: string; label: string; ratio: number }>> {
  try {
    await requirePermission("takeoffs", "update");
    const parsed = scalePresetSchema.parse(input);
    const preset = await ScalePresetService.createScalePreset(parsed);
    revalidatePath("/drawings");
    return { ok: true, data: preset };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteScalePresetAction(id: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await ScalePresetService.deleteScalePreset(id);
    revalidatePath("/drawings");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Rate card (Phase 2, Part B)
// ---------------------------------------------------------------------------

export async function createRateCardItemAction(input: TakeoffItemPresetInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("takeoffRateCard", "create");
    const parsed = takeoffItemPresetSchema.parse(input);
    const item = await RateCardService.createRateCardItem(parsed);
    revalidatePath("/drawings/rate-card");
    return { ok: true, data: item };
  } catch (err) {
    return fail(err);
  }
}

export async function updateRateCardItemAction(id: string, input: TakeoffItemPresetInput): Promise<ActionResult> {
  try {
    await requirePermission("takeoffRateCard", "update");
    const parsed = takeoffItemPresetSchema.parse(input);
    await RateCardService.updateRateCardItem(id, parsed);
    revalidatePath("/drawings/rate-card");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function moveRateCardItemAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requirePermission("takeoffRateCard", "update");
    await RateCardService.moveRateCardItem(id, direction);
    revalidatePath("/drawings/rate-card");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteRateCardItemAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requirePermission("takeoffRateCard", "delete");
    await RateCardService.softDeleteRateCardItem(id, actor.id);
    revalidatePath("/drawings/rate-card");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function listRateCardItemsAction(): Promise<ActionResult<RateCardService.RateCardItem[]>> {
  try {
    await requirePermission("takeoffRateCard", "read");
    const items = await RateCardService.listRateCardItems();
    return { ok: true, data: items };
  } catch (err) {
    return fail(err);
  }
}

/** "Add all from rate card" on a takeoff -- any role that can update takeoffs (not just the rate card). */
export async function addAllFromRateCardAction(
  takeoffId: string
): Promise<ActionResult<RateCardService.AddedRateCardItem[]>> {
  try {
    await requirePermission("takeoffs", "update");
    const takeoff = await TakeoffService.getTakeoff(takeoffId);
    if (!takeoff) return { ok: false, message: "Takeoff not found." };
    const added = await RateCardService.addAllRateCardItemsToTakeoff(takeoffId, takeoff.items);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: added };
  } catch (err) {
    return fail(err);
  }
}

/** "Save to rate card" on a custom item on a takeoff -- requires rate-card write access, since it writes the shared card. */
export async function saveItemAsPresetAction(name: string, colour: string, pricePerMetre: number): Promise<ActionResult<{ created: boolean }>> {
  try {
    await requirePermission("takeoffRateCard", "create");
    const result = await RateCardService.upsertRateCardItemByName(name, colour, pricePerMetre);
    revalidatePath("/drawings/rate-card");
    return { ok: true, data: { created: result.created } };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Files (Drawings Part 1 Step 4)
// ---------------------------------------------------------------------------

export async function createTakeoffFileAction(takeoffId: string, input: TakeoffFileCreateInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("takeoffs", "update");
    const parsed = takeoffFileCreateSchema.parse(input);
    const file = await TakeoffService.createTakeoffFile(takeoffId, parsed);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: file };
  } catch (err) {
    return fail(err);
  }
}

export async function renameTakeoffFileAction(takeoffId: string, fileId: string, input: TakeoffFileRenameInput): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    const parsed = takeoffFileRenameSchema.parse(input);
    await TakeoffService.renameTakeoffFile(fileId, parsed.name);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function moveTakeoffFileAction(takeoffId: string, fileId: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.moveTakeoffFile(takeoffId, fileId, direction);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

/** Confirm-dialog support -- lets the UI say "this file has N measurements" before the user confirms removing it. */
export async function countMeasurementsOnFileAction(takeoffId: string, fileId: string): Promise<ActionResult<{ count: number }>> {
  try {
    await requirePermission("takeoffs", "read");
    const count = await TakeoffService.countMeasurementsOnFile(takeoffId, fileId);
    return { ok: true, data: { count } };
  } catch (err) {
    return fail(err);
  }
}

export async function removeTakeoffFileAction(takeoffId: string, fileId: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.softDeleteTakeoffFile(fileId);
    revalidatePath(`/drawings/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}
