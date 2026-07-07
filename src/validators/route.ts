import { z } from "zod";

export const planDayInputSchema = z.object({
  technicianId: z.string().min(1),
  dateISO: z.string().min(1),
  origin: z.object({ latitude: z.number(), longitude: z.number() }).nullable(),
  originSource: z.enum(["geolocation", "manual"]).optional(),
});
export type PlanDayInput = z.infer<typeof planDayInputSchema>;

export const geocodeAddressInputSchema = z.object({
  address: z.string().min(3).max(200),
});
export type GeocodeAddressInput = z.infer<typeof geocodeAddressInputSchema>;
