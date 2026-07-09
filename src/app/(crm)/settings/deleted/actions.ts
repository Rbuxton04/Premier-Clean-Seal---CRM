"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { writeAudit, actorContext } from "@/lib/audit";
import * as JobService from "@/services/job.service";
import * as QuoteService from "@/services/quote.service";
import * as InvoiceService from "@/services/invoice.service";
import * as CustomerService from "@/services/customer.service";
import type { RecordActionResult } from "@/components/record-action-button";

function revalidateAfterRestore() {
  revalidatePath("/settings/deleted");
  revalidatePath("/jobs");
  revalidatePath("/quotes");
  revalidatePath("/invoices");
  revalidatePath("/calendar");
  revalidatePath("/map");
  revalidatePath("/customers");
}

export async function restoreJobAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    await JobService.restoreJob(id);
    const { ip } = await actorContext();
    await writeAudit({ userId: actor.id, action: "RESTORE", resource: "job", resourceId: id, ip });
    revalidateAfterRestore();
    return { ok: true, message: "Restored" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}

export async function restoreQuoteAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    await QuoteService.restoreQuote(id);
    const { ip } = await actorContext();
    await writeAudit({ userId: actor.id, action: "RESTORE", resource: "quote", resourceId: id, ip });
    revalidateAfterRestore();
    return { ok: true, message: "Restored" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}

export async function restoreInvoiceAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    await InvoiceService.restoreInvoice(id);
    const { ip } = await actorContext();
    await writeAudit({ userId: actor.id, action: "RESTORE", resource: "invoice", resourceId: id, ip });
    revalidateAfterRestore();
    return { ok: true, message: "Restored" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}

export async function restorePropertyAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    await CustomerService.restoreProperty(id);
    const { ip } = await actorContext();
    await writeAudit({ userId: actor.id, action: "RESTORE", resource: "property", resourceId: id, ip });
    revalidateAfterRestore();
    return { ok: true, message: "Restored" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}
