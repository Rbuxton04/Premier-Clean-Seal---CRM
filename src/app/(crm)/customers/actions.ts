"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customerSchema, propertySchema } from "@/validators/customer";
import { workLogSchema } from "@/validators/work-log";
import { sendPortalLinkSchema } from "@/validators/portal";
import * as CustomerService from "@/services/customer.service";
import * as PropertyService from "@/services/property.service";
import * as PortalService from "@/services/portal.service";
import { writeAudit, actorContext } from "@/lib/audit";

export type FormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

function fieldErrors(e: import("zod").ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of e.errors) errors[String(issue.path[0])] = issue.message;
  return errors;
}

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    notes: formData.get("notes") || undefined,
    marketingEmail: formData.get("marketingEmail") === "on",
    marketingSms: formData.get("marketingSms") === "on",
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  const customer = await CustomerService.createCustomer(parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "customer", resourceId: customer.id, after: parsed.data, ip });
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    notes: formData.get("notes") || undefined,
    marketingEmail: formData.get("marketingEmail") === "on",
    marketingSms: formData.get("marketingSms") === "on",
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  const before = await CustomerService.getCustomer(id);
  await CustomerService.updateCustomer(id, parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({
    userId,
    action: "UPDATE",
    resource: "customer",
    resourceId: id,
    before: before ? { name: before.name, company: before.company, phone: before.phone, email: before.email } : undefined,
    after: parsed.data,
    ip,
  });
  revalidatePath(`/customers/${id}`);
  return { ok: true, message: "Customer updated" };
}

export async function addPropertyAction(customerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = propertySchema.safeParse({
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city") || undefined,
    postcode: formData.get("postcode"),
    propertyType: formData.get("propertyType") || "RESIDENTIAL",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  await CustomerService.addProperty(customerId, parsed.data);
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: "Property added" };
}

export async function deletePropertyAction(customerId: string, propertyId: string) {
  await CustomerService.deleteProperty(propertyId);
  revalidatePath(`/customers/${customerId}`);
}

export async function addWorkLogAction(customerId: string, propertyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = workLogSchema.safeParse({
    description: formData.get("description"),
    productId: formData.get("productId") || undefined,
    productText: formData.get("productText"),
    colour: formData.get("colour"),
    area: formData.get("area") || undefined,
    batchNumber: formData.get("batchNumber") || undefined,
    completedAt: formData.get("completedAt"),
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  await PropertyService.addWorkLogEntry(customerId, propertyId, parsed.data);
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: "Work log entry added" };
}

export async function deleteWorkLogAction(customerId: string, workLogId: string) {
  await PropertyService.deleteWorkLogEntry(workLogId);
  revalidatePath(`/customers/${customerId}`);
}

export async function setCustomerTagsAction(customerId: string, formData: FormData) {
  const tagIds = formData.getAll("tagIds").map(String);
  const { setCustomerTags } = await import("@/services/tag.service");
  await setCustomerTags(customerId, tagIds);
  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

export type SendPortalLinkState = { ok: boolean; message: string; url?: string } | null;

export async function sendPortalLinkAction(customerId: string, _prev: SendPortalLinkState, formData: FormData): Promise<SendPortalLinkState> {
  const parsed = sendPortalLinkSchema.safeParse({ expiryDays: formData.get("expiryDays") || undefined });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please check the expiry." };

  const result = await PortalService.sendPortalLinkToCustomer(customerId, parsed.data.expiryDays);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "portal.token", resourceId: customerId, after: { expiryDays: parsed.data.expiryDays }, ip });
  revalidatePath(`/customers/${customerId}`);
  return {
    ok: true,
    message: result.emailed ? "Portal link emailed to the customer." : "Email isn't configured yet — copy the link below to share it.",
    url: result.url,
  };
}

export async function revokePortalTokenAction(customerId: string, tokenId: string) {
  await PortalService.revokePortalToken(tokenId);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "REVOKE", resource: "portal.token", resourceId: tokenId, ip });
  revalidatePath(`/customers/${customerId}`);
}
