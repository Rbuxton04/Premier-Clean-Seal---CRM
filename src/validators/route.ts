import { z } from "zod";

export const planDayInputSchema = z.object({
  technicianId: z.string().min(1),
  dateISO: z.string().min(1),
  origin: z.object({ latitude: z.number(), longitude: z.number() }).nullable(),
  originSource: z.enum(["geolocation", "manual"]).optional(),
  finishMode: z.enum(["home", "none", "custom"]).optional(),
  customFinishAddress: z.string().max(200).nullable().optional(),
});
export type PlanDayInput = z.infer<typeof planDayInputSchema>;

export const geocodeAddressInputSchema = z.object({
  address: z.string().min(3).max(200),
});
export type GeocodeAddressInput = z.infer<typeof geocodeAddressInputSchema>;

export const setHomeAddressInputSchema = z.object({
  technicianId: z.string().min(1),
  // Empty string clears the saved home address — allowed here (min 0), the
  // service layer geocodes non-empty values.
  address: z.string().max(200),
});
export type SetHomeAddressInput = z.infer<typeof setHomeAddressInputSchema>;
