"use server";

import { revalidatePath } from "next/cache";
import { setSmsConsentByToken, resubscribeEmailByToken } from "@/services/marketing.service";

export async function stopSmsAction(token: string): Promise<{ ok: boolean }> {
  const result = await setSmsConsentByToken(token, false);
  revalidatePath(`/unsubscribe/${token}`);
  return result;
}

export async function resubscribeAction(token: string): Promise<{ ok: boolean }> {
  const result = await resubscribeEmailByToken(token);
  revalidatePath(`/unsubscribe/${token}`);
  return result;
}
