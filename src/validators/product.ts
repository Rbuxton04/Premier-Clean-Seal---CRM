import { z } from "zod";

// Checkbox suggestions only, not a closed set -- Product.attributes is a
// plain String[] column (see the schema comment), and the seeded catalogue
// already has an "EXTERNAL" value outside this curated list (the Dow 791
// Weatherproofing products). Validating against z.enum(productAttributes)
// would reject a save on those products unless the form round-tripped every
// unknown value perfectly; z.array(z.string()) below accepts anything,
// while the checkboxes in product-form.tsx only ever toggle membership of
// these five, leaving any other existing value untouched.
export const productAttributes = ["FIRE_RATED", "NEUTRAL_CURE", "ACOUSTIC", "LMN", "SANITARY"] as const;
export const productAttributeLabels: Record<string, string> = {
  FIRE_RATED: "Fire rated",
  NEUTRAL_CURE: "Neutral cure",
  ACOUSTIC: "Acoustic",
  LMN: "LMN",
  SANITARY: "Sanitary",
  EXTERNAL: "External",
};

// Same "coerce empty string to undefined" pattern as validators/hotel.ts --
// a blank optional-number input must clear the field, not save 0.
const optionalNumber = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().nonnegative().optional());

export const productSchema = z.object({
  manufacturer: z.string().min(1, "Manufacturer is required"),
  name: z.string().min(1, "Name is required"),
  colour: z.string().min(1, "Colour is required"),
  finish: z.string().optional(),
  attributes: z.array(z.string()).default([]),
  supplier: z.string().optional(),
  sku: z.string().optional(),
  unitCost: optionalNumber,
  stockQuantity: z.coerce.number().default(0),
  stockUnit: z.string().min(1).default("tubes"),
  lowStockThreshold: optionalNumber,
});
export type ProductInput = z.infer<typeof productSchema>;

export const stockAdjustSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number(),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
