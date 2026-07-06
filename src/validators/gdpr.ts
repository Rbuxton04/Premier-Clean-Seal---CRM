import { z } from "zod";

// Requires the operator to type the exact word DELETE, plus the customer's
// name, so an accidental click can never trigger an irreversible erasure.
export const eraseCustomerSchema = z.object({
  confirmText: z.literal("DELETE", { message: "Type DELETE (all caps) to confirm." }),
  customerName: z.string().min(1),
});
export type EraseCustomerInput = z.infer<typeof eraseCustomerSchema>;
