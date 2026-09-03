"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { hotelGroupSchema, hotelPropertySchema } from "@/validators/hotel";
import { roomBulkCreateSchema, type roomStatusButtons } from "@/validators/room";
import * as HotelGroupService from "@/services/hotel-group.service";
import * as HotelPropertyService from "@/services/hotel-property.service";
import * as RoomService from "@/services/room.service";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { actorContext, writeAudit } from "@/lib/audit";
import type { RecordActionResult } from "@/components/record-action-button";
import type { RoomStatus } from "@prisma/client";

export type FormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

function fieldErrors(e: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of e.errors) errors[String(issue.path[0])] = issue.message;
  return errors;
}

// ---------------------------------------------------------------------------
// Hotel groups
// ---------------------------------------------------------------------------

export async function createHotelGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requirePermission("properties", "create");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = hotelGroupSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  const group = await HotelGroupService.createHotelGroup(parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "hotel_group", resourceId: group.id, after: { name: parsed.data.name }, ip });
  revalidatePath("/properties");
  redirect(`/properties/groups/${group.id}`);
}

export async function updateHotelGroupAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requirePermission("properties", "update");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = hotelGroupSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  await HotelGroupService.updateHotelGroup(id, parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "UPDATE", resource: "hotel_group", resourceId: id, after: { name: parsed.data.name }, ip });
  revalidatePath(`/properties/groups/${id}`);
  revalidatePath("/properties");
  return { ok: true, message: "Saved" };
}

// ---------------------------------------------------------------------------
// Hotel properties
// ---------------------------------------------------------------------------

export async function createHotelPropertyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requirePermission("properties", "create");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = hotelPropertySchema.safeParse({
    hotelGroupId: formData.get("hotelGroupId") || undefined,
    customerId: formData.get("customerId") || undefined,
    name: formData.get("name"),
    addressLine1: formData.get("addressLine1"),
    town: formData.get("town") || undefined,
    region: formData.get("region") || undefined,
    postcode: formData.get("postcode"),
    totalBedrooms: formData.get("totalBedrooms") || undefined,
    siteContactName: formData.get("siteContactName") || undefined,
    siteContactRole: formData.get("siteContactRole") || undefined,
    siteContactPhone: formData.get("siteContactPhone") || undefined,
    siteContactEmail: formData.get("siteContactEmail") || undefined,
    accessNotes: formData.get("accessNotes") || undefined,
    sealantBrand: formData.get("sealantBrand") || undefined,
    sealantColour: formData.get("sealantColour") || undefined,
    sealantTubePriceGbp: formData.get("sealantTubePriceGbp") || undefined,
    priceFullBathGbp: formData.get("priceFullBathGbp") || undefined,
    priceShowerOnlyGbp: formData.get("priceShowerOnlyGbp") || undefined,
    resealIntervalMonths: formData.get("resealIntervalMonths") || 36,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  const property = await HotelPropertyService.createHotelProperty(parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "hotel_property", resourceId: property.id, after: { name: parsed.data.name }, ip });
  revalidatePath("/properties");
  if (parsed.data.hotelGroupId) revalidatePath(`/properties/groups/${parsed.data.hotelGroupId}`);
  else revalidatePath("/properties/groups/independent");
  redirect(`/properties/${property.id}`);
}

export async function updateHotelPropertyAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requirePermission("properties", "update");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = hotelPropertySchema.safeParse({
    hotelGroupId: formData.get("hotelGroupId") || undefined,
    customerId: formData.get("customerId") || undefined,
    name: formData.get("name"),
    addressLine1: formData.get("addressLine1"),
    town: formData.get("town") || undefined,
    region: formData.get("region") || undefined,
    postcode: formData.get("postcode"),
    totalBedrooms: formData.get("totalBedrooms") || undefined,
    siteContactName: formData.get("siteContactName") || undefined,
    siteContactRole: formData.get("siteContactRole") || undefined,
    siteContactPhone: formData.get("siteContactPhone") || undefined,
    siteContactEmail: formData.get("siteContactEmail") || undefined,
    accessNotes: formData.get("accessNotes") || undefined,
    sealantBrand: formData.get("sealantBrand") || undefined,
    sealantColour: formData.get("sealantColour") || undefined,
    sealantTubePriceGbp: formData.get("sealantTubePriceGbp") || undefined,
    priceFullBathGbp: formData.get("priceFullBathGbp") || undefined,
    priceShowerOnlyGbp: formData.get("priceShowerOnlyGbp") || undefined,
    resealIntervalMonths: formData.get("resealIntervalMonths") || 36,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  await HotelPropertyService.updateHotelProperty(id, parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "UPDATE", resource: "hotel_property", resourceId: id, after: { name: parsed.data.name }, ip });
  revalidatePath(`/properties/${id}`);
  revalidatePath("/properties");
  revalidatePath("/properties/due");
  return { ok: true, message: "Saved" };
}

// ---------------------------------------------------------------------------
// Bulk room creation
// ---------------------------------------------------------------------------

export type BulkCreateRoomsResult = RecordActionResult & { created?: number; skipped?: string[] };

export async function bulkCreateRoomsAction(propertyId: string, floor: string, roomNumberRange: string, bathroomType: string): Promise<BulkCreateRoomsResult> {
  try {
    await requirePermission("properties", "create");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = roomBulkCreateSchema.safeParse({ floor: floor || undefined, roomNumberRange, bathroomType });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };

  try {
    const result = await RoomService.bulkCreateRooms(propertyId, parsed.data);
    const { userId, ip } = await actorContext();
    await writeAudit({ userId, action: "CREATE", resource: "room_batch", resourceId: propertyId, after: { created: result.created, skipped: result.skipped }, ip });
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath(`/properties/${propertyId}/rooms/new`);
    const message =
      result.skipped.length > 0
        ? `Created ${result.created} room${result.created === 1 ? "" : "s"}, skipped ${result.skipped.length} duplicate${result.skipped.length === 1 ? "" : "s"} (${result.skipped.join(", ")}).`
        : `Created ${result.created} room${result.created === 1 ? "" : "s"}.`;
    return { ok: true, message, created: result.created, skipped: result.skipped };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not create rooms." };
  }
}

// ---------------------------------------------------------------------------
// Room status + Done
// ---------------------------------------------------------------------------

function revalidatePropertyPaths(propertyId: string): void {
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties");
  revalidatePath("/properties/due");
}

export async function markRoomDoneAction(propertyId: string, roomId: string): Promise<RecordActionResult> {
  try {
    await requirePermission("properties", "update");
    await RoomService.markRoomDone(roomId);
    revalidatePropertyPaths(propertyId);
    return { ok: true, message: "Marked done" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    return { ok: false, message: "Could not update the room." };
  }
}

export async function setRoomStatusAction(propertyId: string, roomId: string, status: Exclude<RoomStatus, "DONE">): Promise<RecordActionResult> {
  try {
    await requirePermission("properties", "update");
    await RoomService.setRoomStatus(roomId, status);
    revalidatePropertyPaths(propertyId);
    return { ok: true, message: "Updated" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    return { ok: false, message: "Could not update the room." };
  }
}

export async function applyQuickMarkAction(propertyId: string, roomId: string, status: (typeof roomStatusButtons)[number]): Promise<RecordActionResult> {
  try {
    await requirePermission("properties", "update");
    await RoomService.applyQuickMark(roomId, status);
    revalidatePropertyPaths(propertyId);
    return { ok: true, message: "Updated" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    return { ok: false, message: "Could not update the room." };
  }
}

/** Read-only -- fetches one room's full detail (incl. works history) for the room sheet, same no-gate-on-reads convention as every page in this area. */
export async function getRoomDetailAction(roomId: string) {
  return RoomService.getRoomDetail(roomId);
}
