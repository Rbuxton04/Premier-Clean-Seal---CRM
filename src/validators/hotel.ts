import { z } from "zod";

export const hotelGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});
export type HotelGroupInput = z.infer<typeof hotelGroupSchema>;

// coerce.number().optional() still trips on an empty-string FormData value
// (empty string coerces to 0, not undefined) -- the .or(z.literal("")) /
// preprocess-to-undefined pattern below is repeated for every optional
// numeric field so a blank input clears the field rather than saving 0.
const optionalNumber = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().optional());
const optionalInt = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().optional());

export const hotelPropertySchema = z.object({
  hotelGroupId: z.string().optional(),
  customerId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  addressLine1: z.string().min(1, "Address is required"),
  town: z.string().optional(),
  region: z.string().optional(),
  postcode: z.string().min(1, "Postcode is required"),
  totalBedrooms: optionalInt,
  siteContactName: z.string().optional(),
  siteContactRole: z.string().optional(),
  siteContactPhone: z.string().optional(),
  siteContactEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  accessNotes: z.string().optional(),
  sealantBrand: z.string().optional(),
  sealantColour: z.string().optional(),
  sealantTubePriceGbp: optionalNumber,
  priceFullBathGbp: optionalNumber,
  priceShowerOnlyGbp: optionalNumber,
  resealIntervalMonths: z.coerce.number().int().positive().default(36),
  notes: z.string().optional(),
});
export type HotelPropertyInput = z.infer<typeof hotelPropertySchema>;
