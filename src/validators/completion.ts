import { z } from "zod";

export const applicationAreas = [
  "INTERNAL",
  "EXTERNAL",
  "BATHROOM",
  "ENSUITE",
  "KITCHEN",
  "WINDOW",
  "EXPANSION_JOINT",
] as const;

export const applicationAreaLabels: Record<(typeof applicationAreas)[number], string> = {
  INTERNAL: "Internal (other)",
  EXTERNAL: "External",
  BATHROOM: "Bathroom",
  ENSUITE: "Ensuite",
  KITCHEN: "Kitchen",
  WINDOW: "Window",
  EXPANSION_JOINT: "Expansion joint",
};

export const photoCategories = ["BEFORE", "DURING", "AFTER"] as const;
export const photoCategoryLabels: Record<(typeof photoCategories)[number], string> = {
  BEFORE: "Before",
  DURING: "During",
  AFTER: "After",
};

export const materialUsageSchema = z.object({
  productId: z.string().optional(),
  productText: z.string().min(1, "Product is required"),
  colour: z.string().min(1, "Colour is required"),
  applicationArea: z.enum(applicationAreas),
  batchNumber: z.string().optional(),
  quantityUsed: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1).default("tubes"),
  cost: z.coerce.number().nonnegative().optional(),
});
export type MaterialUsageInput = z.infer<typeof materialUsageSchema>;

export const completionPhotoSchema = z.object({
  category: z.enum(photoCategories),
  dataUrl: z.string().min(1),
});
export type CompletionPhotoInput = z.infer<typeof completionPhotoSchema>;

export const completionFormSchema = z.object({
  materials: z.array(materialUsageSchema).min(1, "Add at least one material used"),
  metresInstalled: z.coerce.number().nonnegative().optional(),
  actualStart: z.coerce.date().optional(),
  actualEnd: z.coerce.date().optional(),
  completionNotes: z.string().optional(),
  satisfactionRating: z.coerce.number().int().min(1).max(5).optional(),
  signatureDataUrl: z.string().optional(),
  photos: z.array(completionPhotoSchema).optional(),
});
export type CompletionInput = z.infer<typeof completionFormSchema>;
