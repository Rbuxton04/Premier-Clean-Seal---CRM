"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { jobFormSchema, jobUpdateSchema } from "@/validators/job";
import * as JobService from "@/services/job.service";
import { canViewFinancials, requireAdmin, ForbiddenError } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit, actorContext } from "@/lib/audit";
import type { RecordActionResult } from "@/components/record-action-button";

export type JobFormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

function fieldErrors(e: import("zod").ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of e.errors) errors[String(issue.path[0])] = issue.message;
  return errors;
}

export async function createJobAction(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const parsed = jobFormSchema.safeParse({
    customerId: formData.get("customerId"),
    propertyId: formData.get("propertyId") || undefined,
    technicianId: formData.get("technicianId") || undefined,
    scheduledStart: formData.get("scheduledStart") || undefined,
    price: formData.get("price"),
    depositPaid: formData.get("depositPaid") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  const job = await JobService.createJob(parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "job", resourceId: job.id, after: { customerId: parsed.data.customerId }, ip });
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}

export async function updateJobAction(id: string, _prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const parsed = jobUpdateSchema.safeParse({
    status: formData.get("status") || undefined,
    technicianId: formData.get("technicianId") ?? undefined,
    scheduledStart: formData.get("scheduledStart") || undefined,
    scheduledEnd: formData.get("scheduledEnd") || undefined,
    price: formData.get("price") || undefined,
    depositPaid: formData.get("depositPaid") || undefined,
    notes: formData.get("notes") || undefined,
    internalNotes: formData.get("internalNotes") || undefined,
    // Checkbox: absent from FormData when unchecked, so this always resolves
    // to a definite true/false rather than leaving the field untouched.
    isExternal: formData.get("isExternal") === "on",
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  // Financial fields can never be changed by a role that isn't allowed to see
  // them, regardless of what the submitted form contained.
  const user = await getCurrentUser();
  if (!user || !canViewFinancials(user.role)) {
    parsed.data.price = undefined;
    parsed.data.depositPaid = undefined;
  }
  // TECHNICIAN can only update jobs assigned to them.
  if (user?.role === "TECHNICIAN") {
    const job = await JobService.getJob(id);
    if (!job || job.technicianId !== user.id) return { ok: false, message: "You can only update jobs assigned to you." };
  }

  await JobService.updateJob(id, parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "UPDATE", resource: "job", resourceId: id, after: { status: parsed.data.status }, ip });
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return { ok: true, message: "Saved" };
}

export async function scheduleJobAction(jobId: string, technicianId: string | null, dateISO: string | null): Promise<void> {
  await JobService.scheduleJob(jobId, technicianId, dateISO);
  revalidatePath("/calendar");
  revalidatePath("/jobs");
}

/**
 * Soft-delete is Admin-only, enforced here server-side regardless of
 * whether the Delete button was even visible to the caller — the client
 * confirmation dialog is a UX nicety, never the security boundary.
 */
export async function deleteJobAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    const job = await JobService.getJob(id);
    if (!job) return { ok: false, message: "Job not found." };

    await JobService.softDeleteJob(id, actor.id);
    const { userId, ip } = await actorContext();
    await writeAudit({ userId, action: "DELETE", resource: "job", resourceId: id, before: { jobNumber: job.jobNumber }, ip });
    revalidatePath("/jobs");
    revalidatePath("/calendar");
    revalidatePath("/map");
    revalidatePath("/settings/deleted");
    return { ok: true, message: "Deleted" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}
