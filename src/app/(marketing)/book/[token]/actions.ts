"use server";

import { rebookingRequestSchema } from "@/validators/marketing";
import { getRebookingCustomer, createRebookingEnquiry } from "@/services/marketing.service";
import { checkRateLimit } from "@/lib/rate-limit";

export type RebookingFormState = { ok: boolean; message: string } | null;

export async function submitRebookingAction(token: string, _prev: RebookingFormState, formData: FormData): Promise<RebookingFormState> {
  const { allowed } = checkRateLimit(`rebooking:${token}`);
  if (!allowed) return { ok: false, message: "Too many attempts — please try again shortly." };

  const customer = await getRebookingCustomer(token);
  if (!customer) return { ok: false, message: "This link is invalid or has expired." };

  const parsed = rebookingRequestSchema.safeParse({
    propertyId: formData.get("propertyId"),
    workTypes: formData.getAll("workTypes"),
    description: formData.get("description"),
    reminderId: formData.get("reminderId") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please check the form." };

  await createRebookingEnquiry(customer.id, parsed.data);
  return { ok: true, message: "Thanks — we've got your request and will be in touch shortly." };
}
