"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { quoteFormSchema } from "@/validators/quote";
import * as QuoteService from "@/services/quote.service";
import * as JobService from "@/services/job.service";
import type { SendQuoteResult } from "@/services/quote.service";
import type { ConvertToJobResult } from "@/services/job.service";
import { writeAudit, actorContext } from "@/lib/audit";

export type QuoteFormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

function fieldErrors(e: import("zod").ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of e.errors) errors[String(issue.path[0])] = issue.message;
  return errors;
}

function parseQuoteForm(formData: FormData) {
  let lineItems: unknown[] = [];
  try {
    lineItems = JSON.parse(String(formData.get("lineItemsJson") || "[]"));
  } catch {
    lineItems = [];
  }
  return quoteFormSchema.safeParse({
    customerId: formData.get("customerId"),
    enquiryId: formData.get("enquiryId") || undefined,
    scopeOfWorks: formData.get("scopeOfWorks"),
    depositAmount: formData.get("depositAmount") || undefined,
    terms: formData.get("terms") || undefined,
    warrantyMonths: formData.get("warrantyMonths") || undefined,
    lineItems,
  });
}

export async function createQuoteAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  const quote = await QuoteService.createQuote(parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "CREATE", resource: "quote", resourceId: quote.id, after: { customerId: parsed.data.customerId }, ip });
  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

export async function updateQuoteAction(id: string, _prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const existing = await QuoteService.getQuote(id);
  if (!existing) return { ok: false, message: "Quote not found." };
  if (existing.status !== "DRAFT") return { ok: false, message: "Only draft quotes can be edited." };

  const parsed = parseQuoteForm(formData);
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  await QuoteService.updateQuote(id, parsed.data);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "UPDATE", resource: "quote", resourceId: id, before: { total: existing.total, status: existing.status }, ip });
  revalidatePath(`/quotes/${id}`);
  return { ok: true, message: "Saved" };
}

export async function sendQuoteAction(id: string): Promise<SendQuoteResult> {
  const result = await QuoteService.sendQuote(id);
  const { userId, ip } = await actorContext();
  await writeAudit({ userId, action: "SEND", resource: "quote", resourceId: id, after: { emailed: result.emailed }, ip });
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/quotes");
  return result;
}

export async function convertToJobAction(quoteId: string): Promise<ConvertToJobResult> {
  const result = await JobService.convertQuoteToJob(quoteId);
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/jobs");
  return result;
}
