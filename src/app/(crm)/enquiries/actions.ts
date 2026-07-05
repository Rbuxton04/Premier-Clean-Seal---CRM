"use server";

import { revalidatePath } from "next/cache";
import { enquiryFieldsSchema, enquiryStages } from "@/validators/enquiry";
import * as EnquiryService from "@/services/enquiry.service";

export async function moveEnquiryAction(id: string, stage: string, index: number) {
  if (!(enquiryStages as readonly string[]).includes(stage)) throw new Error("Invalid stage");
  await EnquiryService.moveEnquiry(id, stage as (typeof enquiryStages)[number], index);
  revalidatePath("/enquiries");
}

export type FieldsFormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

function fieldErrors(e: import("zod").ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of e.errors) errors[String(issue.path[0])] = issue.message;
  return errors;
}

export async function updateEnquiryFieldsAction(id: string, _prev: FieldsFormState, formData: FormData): Promise<FieldsFormState> {
  const parsed = enquiryFieldsSchema.safeParse({
    stage: formData.get("stage") || undefined,
    priority: formData.get("priority") || undefined,
    assignedToId: formData.get("assignedToId") || undefined,
    estimatedValue: formData.get("estimatedValue") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  const { stage, ...fields } = parsed.data;
  await EnquiryService.updateEnquiryFields(id, fields);
  if (stage) {
    const current = await EnquiryService.getEnquiry(id);
    if (current && current.stage !== stage) {
      // Changing stage here (rather than by dragging on the board) appends
      // to the end of the destination column — kanbanOrder stays consistent.
      await EnquiryService.moveEnquiry(id, stage, Number.MAX_SAFE_INTEGER);
    }
  }
  revalidatePath(`/enquiries/${id}`);
  revalidatePath("/enquiries");
  return { ok: true, message: "Saved" };
}

export async function linkToCustomerAction(enquiryId: string, customerId: string) {
  await EnquiryService.convertToExistingCustomer(enquiryId, customerId);
  revalidatePath(`/enquiries/${enquiryId}`);
  revalidatePath("/enquiries");
  revalidatePath("/customers");
}

export async function createCustomerFromEnquiryAction(enquiryId: string) {
  await EnquiryService.convertToNewCustomer(enquiryId);
  revalidatePath(`/enquiries/${enquiryId}`);
  revalidatePath("/enquiries");
  revalidatePath("/customers");
}
