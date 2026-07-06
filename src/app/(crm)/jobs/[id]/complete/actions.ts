"use server";

import { revalidatePath } from "next/cache";
import { completionFormSchema, type CompletionInput } from "@/validators/completion";
import { finishJob } from "@/services/completion.service";

export type FinishJobActionResult = { ok: true; jobId: string } | { ok: false; message: string };

export async function finishJobAction(jobId: string, input: CompletionInput): Promise<FinishJobActionResult> {
  const parsed = completionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Please check the form and try again." };
  }

  await finishJob(jobId, parsed.data);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/invoices");
  revalidatePath("/warranties");

  return { ok: true, jobId };
}
