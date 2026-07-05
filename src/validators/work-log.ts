import { z } from "zod";

export const workLogAreas = [
  "BATHROOM",
  "ENSUITE",
  "KITCHEN",
  "WINDOW",
  "EXTERNAL",
  "EXPANSION_JOINT",
  "INTERNAL",
] as const;

export const workLogAreaLabels: Record<(typeof workLogAreas)[number], string> = {
  BATHROOM: "Bathroom",
  ENSUITE: "Ensuite",
  KITCHEN: "Kitchen",
  WINDOW: "Window",
  EXTERNAL: "External",
  EXPANSION_JOINT: "Expansion joint",
  INTERNAL: "Internal (other)",
};

export const workLogSchema = z.object({
  description: z.string().min(1, "Description is required"),
  productId: z.string().optional(),
  productText: z.string().min(1, "Product is required"),
  colour: z.string().min(1, "Colour is required"),
  area: z.enum(workLogAreas).optional(),
  batchNumber: z.string().optional(),
  completedAt: z.coerce.date({ errorMap: () => ({ message: "Completion date is required" }) }),
});

export type WorkLogInput = z.infer<typeof workLogSchema>;
