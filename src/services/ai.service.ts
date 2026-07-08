import { db } from "@/lib/db";
import { getAiProvider, isAiConfigured, currentAiModelName } from "@/lib/ai";
import { isSupabaseStorageConfigured, getFileUrl } from "@/lib/storage/supabase";
import type { AnalyseInput, AIAnalysisResult, Findings } from "@/lib/ai/provider";

// Explicit hand-written return type — see the Prisma typing note in
// customer.service.ts. AIAnalysis has no relations to include here, but the
// Json fields (findings/suggestedProducts) still benefit from a named shape
// at the call site rather than Prisma's inferred `JsonValue`.
export type AIAnalysisDetail = {
  id: string;
  findings: Findings;
  jobSummary: string;
  estimatedWork: string;
  estimatedMetres: unknown;
  suggestedProducts: Array<{ label: string }>;
  suggestedColours: string[];
  suggestedLabourHrs: unknown;
  quoteNotes: string | null;
  confidence: number;
  model: string;
  editedByUser: boolean;
  createdAt: Date;
};

export type RunAnalysisResult =
  | { status: "ok"; analysis: AIAnalysisDetail }
  | { status: "queued"; message: string }
  | { status: "not_configured"; message: string };

const MAX_IMAGES = 6;

export async function runEnquiryAnalysis(enquiryId: string): Promise<RunAnalysisResult> {
  if (!isAiConfigured()) {
    return { status: "not_configured", message: "AI_API_KEY is not set — analysis is unavailable until it's configured." };
  }

  const enquiry = await db.enquiry.findUniqueOrThrow({
    where: { id: enquiryId },
    include: { files: { where: { kind: "PHOTO" }, orderBy: { createdAt: "asc" } } },
  });

  const products = await db.product.findMany({
    where: { organisationId: enquiry.organisationId },
    select: { manufacturer: true, name: true, colour: true, attributes: true },
  });

  // Photos are stored as private-bucket paths, only resolvable to a
  // fetchable URL (signed, time-limited) once storage is wired — until then
  // fall back to a text-only analysis rather than sending broken links.
  const usableImages = isSupabaseStorageConfigured()
    ? (
        await Promise.all(
          enquiry.files.slice(0, MAX_IMAGES).map(async (f) => {
            const url = await getFileUrl(f.thumbnailUrl ?? f.url);
            return url ? { url } : null;
          })
        )
      ).filter((img): img is { url: string } => img !== null)
    : [];

  const input: AnalyseInput = {
    images: usableImages,
    description: enquiry.description,
    workTypes: enquiry.workTypes,
    propertyType: enquiry.propertyType,
    productCatalogue: products,
  };

  const provider = getAiProvider();

  let result: AIAnalysisResult | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      result = await provider.analyseEnquiryImages(input);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!result) {
    await queuePendingTask(enquiryId, lastError);
    return { status: "queued", message: "Analysis failed and has been queued for retry." };
  }

  const modelName = currentAiModelName();

  const data = {
    findings: result.findings,
    jobSummary: result.jobSummary,
    estimatedWork: result.estimatedWork,
    estimatedMetres: result.estimatedMetres,
    suggestedProducts: result.suggestedProducts,
    suggestedColours: result.suggestedColours,
    suggestedLabourHrs: result.suggestedLabourHrs,
    quoteNotes: result.quoteNotes,
    confidence: result.confidence,
    model: modelName,
    editedByUser: false,
  };

  const saved = await db.aIAnalysis.upsert({
    where: { enquiryId },
    create: { enquiryId, ...data },
    update: data,
  });

  await db.pendingAITask.deleteMany({ where: { type: "ENQUIRY_ANALYSIS", refId: enquiryId } });

  return { status: "ok", analysis: saved as unknown as AIAnalysisDetail };
}

async function queuePendingTask(enquiryId: string, error: string) {
  const existing = await db.pendingAITask.findFirst({ where: { type: "ENQUIRY_ANALYSIS", refId: enquiryId } });
  if (existing) {
    await db.pendingAITask.update({ where: { id: existing.id }, data: { attempts: { increment: 1 }, lastError: error } });
  } else {
    await db.pendingAITask.create({ data: { type: "ENQUIRY_ANALYSIS", refId: enquiryId, attempts: 1, lastError: error } });
  }
}

export type PendingTask = { id: string; attempts: number; lastError: string | null; createdAt: Date };

export async function getPendingAnalysisTask(enquiryId: string): Promise<PendingTask | null> {
  return db.pendingAITask.findFirst({
    where: { type: "ENQUIRY_ANALYSIS", refId: enquiryId },
    select: { id: true, attempts: true, lastError: true, createdAt: true },
  });
}

export type AIAnalysisFieldsInput = {
  jobSummary: string;
  estimatedWork: string;
  estimatedMetres: number | null;
  suggestedLabourHrs: number | null;
  quoteNotes: string | null;
  suggestedColours: string[];
  suggestedProducts: Array<{ label: string }>;
  findings: Findings;
};

export async function updateAIAnalysisFields(enquiryId: string, data: AIAnalysisFieldsInput) {
  return db.aIAnalysis.update({
    where: { enquiryId },
    data: {
      jobSummary: data.jobSummary,
      estimatedWork: data.estimatedWork,
      estimatedMetres: data.estimatedMetres,
      suggestedLabourHrs: data.suggestedLabourHrs,
      quoteNotes: data.quoteNotes,
      suggestedColours: data.suggestedColours,
      suggestedProducts: data.suggestedProducts,
      findings: data.findings,
      editedByUser: true,
    },
  });
}
