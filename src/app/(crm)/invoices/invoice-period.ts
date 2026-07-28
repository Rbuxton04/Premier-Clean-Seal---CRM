export const invoicePeriodPresets = ["all", "month", "quarter", "year", "custom"] as const;
export type InvoicePeriodPreset = (typeof invoicePeriodPresets)[number];

export type InvoicePeriodRange = { preset: InvoicePeriodPreset; from?: Date; to?: Date };

/**
 * Same month/quarter/year math as resolveFinancePeriod in finance.service.ts,
 * but defaults to "all" (no date bound) rather than "month" -- this is the
 * operational invoices list, not a periodic report, so showing everything
 * unless staff narrow it down is the more useful default. "to" is always
 * exclusive, so callers can use a plain `lt`.
 */
export function resolveInvoicePeriod(preset: InvoicePeriodPreset, customFrom?: string, customTo?: string): InvoicePeriodRange {
  const now = new Date();

  if (preset === "month") {
    return { preset, from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  if (preset === "quarter") {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return { preset, from: new Date(now.getFullYear(), qStartMonth, 1), to: new Date(now.getFullYear(), qStartMonth + 3, 1) };
  }
  if (preset === "year") {
    return { preset, from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
  }
  if (preset === "custom" && customFrom && customTo) {
    const toDate = new Date(customTo);
    return { preset, from: new Date(customFrom), to: new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1) };
  }

  return { preset: "all" };
}
