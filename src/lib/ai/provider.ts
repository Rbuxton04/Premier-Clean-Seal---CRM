import { z } from "zod";

// The single contract every provider must satisfy. Kept intentionally small
// and provider-agnostic — no OpenAI- or Anthropic-specific shapes leak past
// this file.

export const conditionLevels = ["good", "fair", "poor"] as const;

export const findingsSchema = z.object({
  mould: z.boolean(),
  missingSilicone: z.boolean(),
  crackedSilicone: z.boolean(),
  waterIngress: z.boolean(),
  tileGaps: z.boolean(),
  groutCondition: z.enum(conditionLevels),
  cleanliness: z.enum(conditionLevels),
  safetyIssues: z.array(z.string()).default([]),
});
export type Findings = z.infer<typeof findingsSchema>;

export const suggestedProductSchema = z.object({ label: z.string() });

// This is the draft AI ESTIMATE a human reviews and edits — never a binding
// quote. Every field here maps directly onto the AIAnalysis Prisma model
// (minus id/enquiryId/model/editedByUser/createdAt, which the orchestrator
// in ai.service.ts attaches at persistence time).
export const aiAnalysisResultSchema = z.object({
  findings: findingsSchema,
  jobSummary: z.string(),
  estimatedWork: z.string(),
  estimatedMetres: z.number().nonnegative().nullable(),
  suggestedProducts: z.array(suggestedProductSchema).default([]),
  suggestedColours: z.array(z.string()).default([]),
  suggestedLabourHrs: z.number().nonnegative().nullable(),
  quoteNotes: z.string().nullable(),
  confidence: z.number().int().min(0).max(100),
});
export type AIAnalysisResult = z.infer<typeof aiAnalysisResultSchema>;

// Plain JSON Schema mirror of aiAnalysisResultSchema, handed to each
// provider's tool/function-calling API to force a structured reply. Keep
// this in sync with the zod schema above by hand — it's small and the zod
// parse is the actual correctness gate, this only shapes the model's draft.
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "object",
      properties: {
        mould: { type: "boolean" },
        missingSilicone: { type: "boolean" },
        crackedSilicone: { type: "boolean" },
        waterIngress: { type: "boolean" },
        tileGaps: { type: "boolean" },
        groutCondition: { type: "string", enum: ["good", "fair", "poor"] },
        cleanliness: { type: "string", enum: ["good", "fair", "poor"] },
        safetyIssues: { type: "array", items: { type: "string" } },
      },
      required: ["mould", "missingSilicone", "crackedSilicone", "waterIngress", "tileGaps", "groutCondition", "cleanliness", "safetyIssues"],
    },
    jobSummary: { type: "string", description: "One or two sentence summary of the job for a staff member to read at a glance." },
    estimatedWork: { type: "string", description: "Free-text description of the scope of work implied by the photos/description." },
    estimatedMetres: { type: ["number", "null"], description: "Estimated linear metres of new silicone bead, or null if it cannot be estimated." },
    suggestedProducts: {
      type: "array",
      items: { type: "object", properties: { label: { type: "string" } }, required: ["label"] },
      description: "Products from the supplied catalogue that best fit this job (prefer SANITARY grade for bathrooms/showers). May include a product not in the catalogue as free text.",
    },
    suggestedColours: { type: "array", items: { type: "string" } },
    suggestedLabourHrs: { type: ["number", "null"] },
    quoteNotes: { type: ["string", "null"], description: "Notes for whoever drafts the quote — access issues, extra prep needed, etc." },
    confidence: { type: "integer", minimum: 0, maximum: 100, description: "0-100. Use a low score (below 40) if photos are missing, blurry, or the description is too sparse to judge." },
  },
  required: ["findings", "jobSummary", "estimatedWork", "estimatedMetres", "suggestedProducts", "suggestedColours", "suggestedLabourHrs", "quoteNotes", "confidence"],
} as const;

export type AnalyseInput = {
  images: Array<{ url: string }>;
  description: string;
  workTypes: string[];
  propertyType: string;
  productCatalogue: Array<{ manufacturer: string; name: string; colour: string; attributes: string[] }>;
};

// Milestone 8 — AI marketing writer. Deliberately free-text (not tool-calling
// like the analysis above) since campaign copy has no fixed structure to
// validate against; the draft is always reviewed by a human before sending.
export type MarketingCopyInput = {
  tone: string;
  channel: string;
  channelRule: string;
  brief: string;
  sampleMergeFields?: Record<string, string>;
};

export interface AIProvider {
  analyseEnquiryImages(input: AnalyseInput): Promise<AIAnalysisResult>;
  generateMarketingCopy(input: MarketingCopyInput): Promise<string>;
}

const SYSTEM_PROMPT = `You are a surveying assistant for a UK silicone-sealant contractor (Premier Clean & Seal, Wigan).
You analyse enquiry photos and the customer's own description to draft a DRAFT ESTIMATE for a staff member to review — never a binding quote.
Be conservative: if photos are missing or too unclear to judge, say so plainly in jobSummary and quoteNotes and give a low confidence score rather than inventing detail.
When suggesting products, prefer items from the supplied catalogue — favour SANITARY-grade silicone for bathroom/shower/kitchen work — but you may suggest a colour not in the catalogue as free text if it clearly matches what's shown.
Respond only by calling the record_analysis tool.`;

export function buildPrompt(input: AnalyseInput): { system: string; user: string } {
  const catalogueLines = input.productCatalogue
    .map((p) => `- ${p.manufacturer} ${p.name} — ${p.colour}${p.attributes.length ? ` (${p.attributes.join(", ")})` : ""}`)
    .join("\n");

  const user = [
    `Property type: ${input.propertyType}`,
    `Work types requested: ${input.workTypes.join(", ") || "not specified"}`,
    `Customer description: ${input.description}`,
    input.images.length === 0
      ? "No photos are available for this enquiry — base the analysis on the description alone and reflect that in confidence and jobSummary."
      : `${input.images.length} photo(s) are attached above.`,
    "",
    "Product catalogue:",
    catalogueLines || "(catalogue is empty)",
  ].join("\n");

  return { system: SYSTEM_PROMPT, user };
}

const MARKETING_SYSTEM_PROMPT = `You are a marketing copywriter for Premier Clean & Seal, a UK silicone-sealant contracting business based in Wigan, England.
You write short repeat-business campaign copy (reminders, social posts) that a member of staff will review and approve before it is ever sent.
Never fabricate discounts, prices, or guarantees. Keep claims modest and specific to sealant/reseal work.
Merge fields like {firstName} or {bookLink} must be copied exactly as given — never invent new ones or rename them.
Respond with the message copy only — no preamble, no explanation, no markdown formatting, no quote marks around the text.`;

export function buildMarketingPrompt(input: MarketingCopyInput): { system: string; user: string } {
  const mergeLine = input.sampleMergeFields
    ? `Available merge fields (use where natural, copy exactly): ${Object.keys(input.sampleMergeFields)
        .map((k) => `{${k}}`)
        .join(", ")}.`
    : "";

  const user = [
    `Tone: ${input.tone}.`,
    `Channel: ${input.channel}. ${input.channelRule}`,
    mergeLine,
    "",
    `Brief: ${input.brief}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { system: MARKETING_SYSTEM_PROMPT, user };
}
