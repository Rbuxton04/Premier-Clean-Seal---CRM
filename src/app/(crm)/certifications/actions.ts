"use server";

import { revalidatePath } from "next/cache";
import { certificationSchema, type CertificationInput } from "@/validators/certification";
import * as CertificationService from "@/services/certification.service";
import { requirePermission, requireAdmin, ForbiddenError } from "@/lib/permissions";
import { actorContext, writeAudit } from "@/lib/audit";
import type { RecordActionResult } from "@/components/record-action-button";

// Plain-object inputs, not FormData/useFormState -- the form needs to
// presign-and-upload a file client-side (same two-step flow as
// DocumentUploadForm in src/app/(crm)/documents/upload-form.tsx) before it
// has a storage path to submit at all, so there's no plain <form action>
// moment to hook useFormState into.
export type CertFormResult = { ok: true; id: string } | { ok: false; message: string; errors?: Record<string, string> };

export async function createCertificationAction(input: CertificationInput): Promise<CertFormResult> {
  try {
    await requirePermission("certifications", "create");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = certificationSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.errors) errors[String(issue.path[0])] = issue.message;
    return { ok: false, message: "Please fix the errors below.", errors };
  }

  const cert = await CertificationService.createCertification(parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "certification", resourceId: cert.id, after: { name: parsed.data.name }, ip });
  revalidatePath("/certifications");
  revalidatePath("/dashboard");
  return { ok: true, id: cert.id };
}

/**
 * input.fileUrl omitted (undefined) preserves whatever file is already
 * attached -- updateCertification only overwrites fileUrl when the key is
 * present at all. Pass a fresh storage path only when the user actually
 * chose a replacement file; never pass an empty string to "clear" it (no
 * remove-file control exists yet).
 */
export async function updateCertificationAction(id: string, input: CertificationInput): Promise<CertFormResult> {
  try {
    await requirePermission("certifications", "update");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }

  const parsed = certificationSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.errors) errors[String(issue.path[0])] = issue.message;
    return { ok: false, message: "Please fix the errors below.", errors };
  }

  await CertificationService.updateCertification(id, parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "UPDATE", resource: "certification", resourceId: id, after: { name: parsed.data.name }, ip });
  revalidatePath("/certifications");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

/** Admin-only, confirmed client-side (RecordActionButton) -- matches the real delete convention for Job/Customer (requireAdmin(), not the Permission table). */
export async function deleteCertificationAction(id: string): Promise<RecordActionResult> {
  try {
    const actor = await requireAdmin();
    await CertificationService.softDeleteCertification(id, actor.id);
    const { userId, ip } = await actorContext();
    await writeAudit({ userId, action: "DELETE", resource: "certification", resourceId: id, ip });
    revalidatePath("/certifications");
    revalidatePath("/dashboard");
    return { ok: true, message: "Deleted" };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}
