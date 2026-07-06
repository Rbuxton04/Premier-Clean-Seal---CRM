"use server";

import { revalidatePath } from "next/cache";
import { generateWeeklyInsightReport } from "@/services/insight.service";

export type GenerateInsightResult = { ok: boolean; message?: string };

export async function generateInsightNowAction(): Promise<GenerateInsightResult> {
  try {
    await generateWeeklyInsightReport();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to generate report." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/insights");
  return { ok: true };
}
