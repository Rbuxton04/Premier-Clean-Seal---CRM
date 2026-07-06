"use server";

import { revalidatePath } from "next/cache";
import { uploadDocumentSchema, type UploadDocumentInput } from "@/validators/media";
import { createDocument } from "@/services/media.service";

export type UploadDocumentResult = { ok: true; id: string } | { ok: false; message: string };

export async function uploadDocumentAction(input: UploadDocumentInput): Promise<UploadDocumentResult> {
  const parsed = uploadDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please check the form." };

  const doc = await createDocument(parsed.data);
  revalidatePath("/documents");
  if (parsed.data.customerId) revalidatePath(`/customers/${parsed.data.customerId}`);
  if (parsed.data.jobId) revalidatePath(`/jobs/${parsed.data.jobId}`);
  return { ok: true, id: doc.id };
}
