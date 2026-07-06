"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { approveQuoteSchema, rejectQuoteSchema } from "@/validators/quote";
import * as QuoteService from "@/services/quote.service";
import { checkRateLimit } from "@/lib/rate-limit";

export type ApprovalFormState = { ok: boolean; message: string } | null;

export async function approveQuoteAction(token: string, _prev: ApprovalFormState, formData: FormData): Promise<ApprovalFormState> {
  const { allowed } = checkRateLimit(`quote-approve:${token}`);
  if (!allowed) return { ok: false, message: "Too many attempts — please try again shortly." };

  const parsed = approveQuoteSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please type your name." };

  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await QuoteService.approveQuote(token, parsed.data.name, ip);
  revalidatePath(`/quote/${token}`);
  return result.ok ? { ok: true, message: "Quote approved — thank you!" } : { ok: false, message: result.message };
}

export async function rejectQuoteAction(token: string, _prev: ApprovalFormState, formData: FormData): Promise<ApprovalFormState> {
  const { allowed } = checkRateLimit(`quote-reject:${token}`);
  if (!allowed) return { ok: false, message: "Too many attempts — please try again shortly." };

  const parsed = rejectQuoteSchema.safeParse({ reason: formData.get("reason") || undefined });
  if (!parsed.success) return { ok: false, message: "Something went wrong." };

  const result = await QuoteService.rejectQuote(token, parsed.data.reason);
  revalidatePath(`/quote/${token}`);
  return result.ok ? { ok: true, message: "Quote declined." } : { ok: false, message: result.message };
}
