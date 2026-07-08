import { z } from "zod";

export const financePeriodPresets = ["month", "quarter", "year", "custom"] as const;

export const financePeriodQuerySchema = z.object({
  period: z.enum(financePeriodPresets).default("month"),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type FinancePeriodQuery = z.infer<typeof financePeriodQuerySchema>;

export const financeStatusFilterValues = ["UNPAID", "DEPOSIT_PAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "REFUNDED"] as const;

export const financeInvoiceFilterQuerySchema = financePeriodQuerySchema.extend({
  status: z.enum(financeStatusFilterValues).optional(),
  customerId: z.string().optional(),
});
export type FinanceInvoiceFilterQuery = z.infer<typeof financeInvoiceFilterQuerySchema>;
