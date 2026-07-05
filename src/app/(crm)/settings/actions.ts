"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";

const numberFormat = z
  .string()
  .min(2)
  .regex(/0+$/, "Format must end in a run of zeros, e.g. #Q-0000");

const settingsSchema = z.object({
  vatRegistered: z.coerce.boolean(),
  vatRatePercent: z.coerce.number().min(0).max(100),
  vatNumber: z.string().optional(),
  defaultWarrantyMonths: z.coerce.number().int().min(1).max(120),
  defaultReminderMonths: z.coerce.number().int().min(1).max(60),
  quoteNumberFormat: numberFormat,
  invoiceNumberFormat: numberFormat,
});

export type SettingsFormState = { ok: boolean; message: string } | null;

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = settingsSchema.safeParse({
    vatRegistered: formData.get("vatRegistered") === "on",
    vatRatePercent: formData.get("vatRatePercent"),
    vatNumber: formData.get("vatNumber") ?? undefined,
    defaultWarrantyMonths: formData.get("defaultWarrantyMonths"),
    defaultReminderMonths: formData.get("defaultReminderMonths"),
    quoteNumberFormat: formData.get("quoteNumberFormat"),
    invoiceNumberFormat: formData.get("invoiceNumberFormat"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Check the form and try again." };
  }

  const before = await db.organisation.findUnique({ where: { id: ORG_ID } });
  await db.organisation.update({ where: { id: ORG_ID }, data: parsed.data });
  await db.auditLog.create({
    data: {
      organisationId: ORG_ID,
      action: "UPDATE",
      resource: "organisation.settings",
      resourceId: ORG_ID,
      before: before ? JSON.parse(JSON.stringify(before)) : undefined,
      after: parsed.data,
    },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Settings saved" };
}
