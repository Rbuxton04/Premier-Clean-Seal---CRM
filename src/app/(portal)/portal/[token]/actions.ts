"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolvePortalToken, updatePortalContactDetails, sendPortalMessage, createPortalRequest } from "@/services/portal.service";
import { approveQuoteForCustomer, rejectQuoteForCustomer } from "@/services/quote.service";
import { portalContactSchema, portalMessageSchema, portalRequestSchema, portalApprovalSchema, portalRejectSchema, type PortalRequestKind } from "@/validators/portal";

export type PortalActionState = { ok: boolean; message: string } | null;

export async function approvePortalQuoteAction(
  token: string,
  quoteId: string,
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const customer = await resolvePortalToken(token);
  if (!customer) return { ok: false, message: "This link is invalid or has expired." };

  const parsed = portalApprovalSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please type your name." };

  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await approveQuoteForCustomer(quoteId, customer.id, parsed.data.name, ip);
  revalidatePath(`/portal/${token}`);
  return result.ok ? { ok: true, message: "Quote approved — thank you!" } : { ok: false, message: result.message };
}

export async function rejectPortalQuoteAction(
  token: string,
  quoteId: string,
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const customer = await resolvePortalToken(token);
  if (!customer) return { ok: false, message: "This link is invalid or has expired." };

  const parsed = portalRejectSchema.safeParse({ reason: formData.get("reason") || undefined });
  if (!parsed.success) return { ok: false, message: "Something went wrong." };

  const result = await rejectQuoteForCustomer(quoteId, customer.id, parsed.data.reason);
  revalidatePath(`/portal/${token}`);
  return result.ok ? { ok: true, message: "Quote declined." } : { ok: false, message: result.message };
}

export async function updatePortalContactAction(token: string, _prev: PortalActionState, formData: FormData): Promise<PortalActionState> {
  const customer = await resolvePortalToken(token);
  if (!customer) return { ok: false, message: "This link is invalid or has expired." };

  const parsed = portalContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please check the form." };

  await updatePortalContactDetails(customer.id, parsed.data);
  revalidatePath(`/portal/${token}`);
  return { ok: true, message: "Details updated — thank you." };
}

export async function sendPortalMessageAction(token: string, _prev: PortalActionState, formData: FormData): Promise<PortalActionState> {
  const customer = await resolvePortalToken(token);
  if (!customer) return { ok: false, message: "This link is invalid or has expired." };

  const { allowed } = checkRateLimit(`portal-message:${token}`);
  if (!allowed) return { ok: false, message: "Please wait a few minutes before sending another message." };

  const parsed = portalMessageSchema.safeParse({ message: formData.get("message") });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please enter a message." };

  await sendPortalMessage(customer.id, parsed.data.message);
  revalidatePath(`/portal/${token}`);
  return { ok: true, message: "Message sent — we'll be in touch." };
}

export async function submitPortalRequestAction(
  token: string,
  kind: PortalRequestKind,
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const customer = await resolvePortalToken(token);
  if (!customer) return { ok: false, message: "This link is invalid or has expired." };

  const { allowed } = checkRateLimit(`portal-request:${token}`);
  if (!allowed) return { ok: false, message: "Please wait a few minutes before submitting another request." };

  const parsed = portalRequestSchema.safeParse({
    propertyId: formData.get("propertyId"),
    workTypes: formData.getAll("workTypes"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please check the form." };

  await createPortalRequest(customer.id, kind, parsed.data);
  revalidatePath(`/portal/${token}`);
  return {
    ok: true,
    message: kind === "maintenance" ? "Thanks — we've got your maintenance request and will be in touch." : "Thanks — we've got your request and will be in touch.",
  };
}
