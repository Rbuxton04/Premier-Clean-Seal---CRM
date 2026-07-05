"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { jobFormSchema, jobUpdateSchema } from "@/validators/job";
import * as JobService from "@/services/job.service";

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
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  await JobService.updateJob(id, parsed.data);
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return { ok: true, message: "Saved" };
}

export async function scheduleJobAction(jobId: string, technicianId: string | null, dateISO: string | null): Promise<void> {
  await JobService.scheduleJob(jobId, technicianId, dateISO);
  revalidatePath("/calendar");
  revalidatePath("/jobs");
}
