"use server";

import { revalidatePath } from "next/cache";
import { productSchema, stockAdjustSchema, type ProductInput } from "@/validators/product";
import * as MaterialsService from "@/services/materials.service";
import { requirePermission, requireAdmin, ForbiddenError } from "@/lib/permissions";
import { actorContext, writeAudit } from "@/lib/audit";
import type { RecordActionResult } from "@/components/record-action-button";

// Plain-object inputs, not FormData/useFormState -- same rationale as the
// certifications form (src/app/(crm)/certifications/actions.ts): the
// attribute checkboxes and numeric fields are easiest to assemble as a
// typed object client-side before a single submit call.
export type ProductFormResult = { ok: true; id: string } | { ok: false; message: string; errors?: Record<string, string> };

function fieldErrorsOf(errors: Array<{ path: (string | number)[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of errors) out[String(issue.path[0])] = issue.message;
  return out;
}

export async function createProductAction(input: ProductInput): Promise<ProductFormResult> {
  try {
    await requirePermission("materials", "create");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrorsOf(parsed.error.errors) };

  const product = await MaterialsService.createProduct(parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "product", resourceId: product.id, after: { manufacturer: parsed.data.manufacturer, name: parsed.data.name, colour: parsed.data.colour }, ip });
  revalidatePath("/materials");
  return { ok: true, id: product.id };
}

export async function updateProductAction(id: string, input: ProductInput): Promise<ProductFormResult> {
  try {
    await requirePermission("materials", "update");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrorsOf(parsed.error.errors) };

  await MaterialsService.updateProduct(id, parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "UPDATE", resource: "product", resourceId: id, after: { manufacturer: parsed.data.manufacturer, name: parsed.data.name, colour: parsed.data.colour }, ip });
  revalidatePath("/materials");
  return { ok: true, id };
}

/** Admin-only, confirmed client-side -- matches the real delete convention for Job/Customer/Certification (requireAdmin(), not just the Permission table). */
export async function deleteProductAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    await MaterialsService.softDeleteProduct(id, actor.id);
    const { userId, ip } = await actorContext();
    await writeAudit({ userId, action: "DELETE", resource: "product", resourceId: id, ip });
    revalidatePath("/materials");
    return { ok: true, message: "Deleted" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}

export type StockActionResult = { ok: boolean; message: string };

/** "+ Add stock" -- a delivery arriving. Office/Admin (the "materials" update permission). */
export async function addStockAction(productId: string, quantity: number): Promise<StockActionResult> {
  try {
    await requirePermission("materials", "update");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = stockAdjustSchema.safeParse({ productId, quantity });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid quantity." };
  if (parsed.data.quantity <= 0) return { ok: false, message: "Enter a positive quantity to add." };

  await MaterialsService.addStock(parsed.data.productId, parsed.data.quantity);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "STOCK_ADD", resource: "product", resourceId: productId, after: { quantity: parsed.data.quantity }, ip });
  revalidatePath("/materials");
  return { ok: true, message: "Stock updated" };
}

/** Manual "set stock to X" -- e.g. reconciling after a physical count. */
export async function setStockAction(productId: string, quantity: number): Promise<StockActionResult> {
  try {
    await requirePermission("materials", "update");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = stockAdjustSchema.safeParse({ productId, quantity });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid quantity." };
  if (parsed.data.quantity < 0) return { ok: false, message: "Stock can't be set below 0." };

  await MaterialsService.setStock(parsed.data.productId, parsed.data.quantity);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "STOCK_SET", resource: "product", resourceId: productId, after: { quantity: parsed.data.quantity }, ip });
  revalidatePath("/materials");
  return { ok: true, message: "Stock updated" };
}
