import { z } from "zod";

export const jobStatuses = ["BOOKED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

export const jobStatusLabels: Record<(typeof jobStatuses)[number], string> = {
  BOOKED: "Booked",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const jobStatusBadgeVariant: Record<(typeof jobStatuses)[number], "default" | "secondary" | "outline" | "success" | "warning"> = {
  BOOKED: "secondary",
  IN_PROGRESS: "default",
  ON_HOLD: "warning",
  COMPLETED: "success",
  CANCELLED: "outline",
};

// Calendar-block styling per status.
export const jobStatusBlockClass: Record<(typeof jobStatuses)[number], string> = {
  BOOKED: "bg-sky-100 border-sky-300 text-sky-900 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-200",
  IN_PROGRESS: "bg-brand-plum-soft border-brand-plum text-brand-plum dark:bg-brand-plum/30 dark:border-brand-plum-bright dark:text-brand-plum-bright",
  ON_HOLD: "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200",
  COMPLETED: "bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200",
  CANCELLED: "bg-muted border-border text-muted-foreground line-through",
};

export const paymentStatuses = ["UNPAID", "DEPOSIT_PAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "REFUNDED"] as const;

export const paymentStatusLabels: Record<(typeof paymentStatuses)[number], string> = {
  UNPAID: "Unpaid",
  DEPOSIT_PAID: "Deposit paid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  REFUNDED: "Refunded",
};

export const jobFormSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  propertyId: z.string().optional(),
  technicianId: z.string().optional(),
  scheduledStart: z.coerce.date().optional(),
  price: z.coerce.number().nonnegative("Price can't be negative"),
  depositPaid: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});
export type JobFormInput = z.infer<typeof jobFormSchema>;

export const jobUpdateSchema = z.object({
  status: z.enum(jobStatuses).optional(),
  technicianId: z.string().optional(),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  price: z.coerce.number().nonnegative().optional(),
  depositPaid: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;
