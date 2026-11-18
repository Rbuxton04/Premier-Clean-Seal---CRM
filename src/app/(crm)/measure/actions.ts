"use server";

import { revalidatePath } from "next/cache";
import {
  takeoffCreateSchema, takeoffItemSchema, takeoffMeasurementSchema, takeoffScaleSchema, scalePresetSchema,
  type TakeoffCreateInput, type TakeoffItemInput, type TakeoffMeasurementInput, type TakeoffScaleInput, type ScalePresetInput,
} from "@/validators/takeoff";
import * as TakeoffService from "@/services/takeoff.service";
import * as ScalePresetService from "@/services/scale-preset.service";
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
    revalidatePath("/measure");
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
    revalidatePath(`/measure/${takeoffId}`);
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
    revalidatePath(`/measure/${takeoffId}`);
    revalidatePath("/measure");
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
    revalidatePath("/measure");
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
    revalidatePath(`/measure/${takeoffId}`);
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
    revalidatePath(`/measure/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteTakeoffItemAction(takeoffId: string, itemId: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.deleteTakeoffItem(itemId);
    revalidatePath(`/measure/${takeoffId}`);
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
    revalidatePath(`/measure/${takeoffId}`);
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

export async function updateMeasurementLabelAction(takeoffId: string, measurementId: string, label: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.updateMeasurementLabel(measurementId, label || null);
    revalidatePath(`/measure/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteMeasurementAction(takeoffId: string, measurementId: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.deleteMeasurement(measurementId);
    revalidatePath(`/measure/${takeoffId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

export async function clearAllMeasurementsAction(takeoffId: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await TakeoffService.clearAllMeasurements(takeoffId);
    revalidatePath(`/measure/${takeoffId}`);
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
    revalidatePath("/measure");
    return { ok: true, data: preset };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteScalePresetAction(id: string): Promise<ActionResult> {
  try {
    await requirePermission("takeoffs", "update");
    await ScalePresetService.deleteScalePreset(id);
    revalidatePath("/measure");
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}
