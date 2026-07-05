"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customerSchema, propertySchema } from "@/validators/customer";
import * as CustomerService from "@/services/customer.service";

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

  await CustomerService.updateCustomer(id, parsed.data);
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

export async function setCustomerTagsAction(customerId: string, formData: FormData) {
  const tagIds = formData.getAll("tagIds").map(String);
  const { setCustomerTags } = await import("@/services/tag.service");
  await setCustomerTags(customerId, tagIds);
  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}
