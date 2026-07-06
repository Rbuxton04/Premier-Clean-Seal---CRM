"use server";

import { revalidatePath } from "next/cache";
import { generateCampaignSchema, rescheduleReminderSchema } from "@/validators/marketing";
import * as MarketingService from "@/services/marketing.service";
import type { RunRemindersResult } from "@/services/marketing.service";

export async function runRemindersNowAction(): Promise<RunRemindersResult> {
  const result = await MarketingService.runDueReminders();
  revalidatePath("/marketing");
  return result;
}

export async function cancelReminderAction(id: string): Promise<void> {
  await MarketingService.cancelReminder(id);
  revalidatePath("/marketing");
}

export async function rescheduleReminderAction(id: string, dueDateIso: string): Promise<{ ok: boolean; message?: string }> {
  const parsed = rescheduleReminderSchema.safeParse({ dueDate: dueDateIso });
  if (!parsed.success) return { ok: false, message: "Invalid date" };
  await MarketingService.rescheduleReminder(id, parsed.data.dueDate);
  revalidatePath("/marketing");
  return { ok: true };
}

export type GenerateCampaignResult = { ok: true; id: string; content: string } | { ok: false; message: string };

export async function generateCampaignAction(input: unknown): Promise<GenerateCampaignResult> {
  const parsed = generateCampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please check the form." };

  try {
    const result = await MarketingService.generateCampaignCopy(parsed.data);
    revalidatePath("/marketing");
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to generate copy." };
  }
}
