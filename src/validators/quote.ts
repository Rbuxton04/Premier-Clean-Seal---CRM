import { z } from "zod";

export const quoteStatuses = ["DRAFT", "SENT", "VIEWED", "APPROVED", "REJECTED", "EXPIRED"] as const;

export const quoteStatusLabels: Record<(typeof quoteStatuses)[number], string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export const quoteStatusBadgeVariant: Record<(typeof quoteStatuses)[number], "default" | "secondary" | "outline" | "success" | "warning"> = {
  DRAFT: "outline",
  SENT: "secondary",
  VIEWED: "secondary",
  APPROVED: "success",
  REJECTED: "warning",
  EXPIRED: "warning",
};

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  unitPrice: z.coerce.number().nonnegative("Unit price can't be negative"),
});
export type LineItemInput = z.infer<typeof lineItemSchema>;

export const quoteFormSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  enquiryId: z.string().optional(),
  scopeOfWorks: z.string().min(1, "Scope of works is required"),
  depositAmount: z.coerce.number().nonnegative().optional(),
  terms: z.string().optional(),
  warrantyMonths: z.coerce.number().int().nonnegative().optional(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});
export type QuoteFormInput = z.infer<typeof quoteFormSchema>;

export const approveQuoteSchema = z.object({
  name: z.string().min(1, "Please type your name to approve this quote"),
});

export const rejectQuoteSchema = z.object({
  reason: z.string().optional(),
});

export const quoteUnits = ["metres", "hours", "each", "tubes", "day"] as const;
