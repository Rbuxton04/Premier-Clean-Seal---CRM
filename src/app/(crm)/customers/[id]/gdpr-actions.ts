"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eraseCustomerSchema } from "@/validators/gdpr";
import { requireAdmin, requirePermission, ForbiddenError } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { eraseCustomer } from "@/services/gdpr.service";
import { getCustomer, setMarketingConsent } from "@/services/customer.service";

export type EraseFormState = { ok: boolean; message: string } | null;

export async function eraseCustomerAction(customerId: string, _prev: EraseFormState, formData: FormData): Promise<EraseFormState> {
  const customer = await getCustomer(customerId);
  if (!customer) return { ok: false, message: "Customer not found." };

  const parsed = eraseCustomerSchema.safeParse({
    confirmText: formData.get("confirmText"),
    customerName: formData.get("customerName"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Please check the confirmation." };
  if (parsed.data.customerName !== customer.name) return { ok: false, message: "The typed name doesn't match this customer's name." };

  try {
    const actor = await requireAdmin();
    const result = await eraseCustomer(customerId);
    if (!result.ok) return { ok: false, message: result.message };

    await writeAudit({
      userId: actor.id,
      action: "ERASE",
      resource: "customer.gdpr",
      resourceId: customerId,
      before: { name: customer.name, email: customer.email, phone: customer.phone },
      ip: headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/customers");
    return { ok: true, message: "This customer's personal data has been erased." };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: err.message };
    throw err;
  }
}

export async function updateConsentAction(customerId: string, marketingEmail: boolean, marketingSms: boolean): Promise<void> {
  const actor = await requirePermission("customers", "update");
  await setMarketingConsent(customerId, marketingEmail, marketingSms);
  await writeAudit({
    userId: actor.id,
    action: "UPDATE",
    resource: "customer.consent",
    resourceId: customerId,
    after: { marketingEmail, marketingSms },
    ip: headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  revalidatePath(`/customers/${customerId}`);
}
