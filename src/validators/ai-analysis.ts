import { z } from "zod";
import { conditionLevels } from "@/lib/ai/provider";

export { conditionLevels };

export const conditionLabels: Record<(typeof conditionLevels)[number], string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export const findingLabels = {
  mould: "Mould",
  missingSilicone: "Missing silicone",
  crackedSilicone: "Cracked silicone",
  waterIngress: "Water ingress",
  tileGaps: "Tile gaps",
} as const;

export const aiAnalysisFieldsSchema = z.object({
  jobSummary: z.string().min(1, "Job summary is required"),
  estimatedWork: z.string().min(1, "Estimated work is required"),
  estimatedMetres: z.coerce.number().nonnegative().optional(),
  suggestedLabourHrs: z.coerce.number().nonnegative().optional(),
  quoteNotes: z.string().optional(),
  suggestedColours: z.array(z.string()).default([]),
  suggestedProducts: z.array(z.string()).default([]),
  mould: z.coerce.boolean().default(false),
  missingSilicone: z.coerce.boolean().default(false),
  crackedSilicone: z.coerce.boolean().default(false),
  waterIngress: z.coerce.boolean().default(false),
  tileGaps: z.coerce.boolean().default(false),
  groutCondition: z.enum(conditionLevels).default("good"),
  cleanliness: z.enum(conditionLevels).default("good"),
  safetyIssues: z.string().optional(),
});

export type AIAnalysisFieldsFormInput = z.infer<typeof aiAnalysisFieldsSchema>;
