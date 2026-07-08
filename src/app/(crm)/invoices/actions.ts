"use server";

import { revalidatePath } from "next/cache";
import * as InvoiceService from "@/services/invoice.service";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { writeAudit, actorContext } from "@/lib/audit";
import type { RecordActionResult } from "@/components/record-action-button";

/**
 * Soft-delete ("void") is Admin-only, enforced here server-side regardless
 * of whether the Delete button was even visible to the caller — the client
 * confirmation dialog is a UX nicety, never the security boundary.
 */
export async function deleteInvoiceAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    const invoice = await InvoiceService.getInvoice(id);
    if (!invoice) return { ok: false, message: "Invoice not found." };

    await InvoiceService.softDeleteInvoice(id, actor.id);
    const { userId, ip } = await actorContext();
    await writeAudit({ userId, action: "DELETE", resource: "invoice", resourceId: id, before: { invoiceNumber: invoice.invoiceNumber }, ip });
    revalidatePath("/invoices");
    revalidatePath("/settings/deleted");
    return { ok: true, message: "Voided" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}
