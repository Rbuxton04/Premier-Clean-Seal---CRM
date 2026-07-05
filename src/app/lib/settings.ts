import { db } from "@/lib/db";

export const ORG_ID = "org_premier"; // single-tenant for now; multi-tenant ready

export async function getOrgSettings() {
  return db.organisation.findUniqueOrThrow({ where: { id: ORG_ID } });
}

/**
 * VAT helper: quotes/invoices snapshot the org's VAT status at the moment
 * they are issued, so historical documents never change retroactively.
 */
export function applyVat(subtotal: number, org: { vatRegistered: boolean; vatRatePercent: unknown }) {
  const rate = org.vatRegistered ? Number(org.vatRatePercent) : 0;
  const vatAmount = +(subtotal * (rate / 100)).toFixed(2);
  return {
    vatApplied: org.vatRegistered,
    vatRatePercent: rate,
    vatAmount,
    total: +(subtotal + vatAmount).toFixed(2),
  };
}
