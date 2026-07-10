"use server";

import { revalidatePath } from "next/cache";
import { enquiryFieldsSchema, enquiryStages } from "@/validators/enquiry";
import { aiAnalysisFieldsSchema } from "@/validators/ai-analysis";
import * as EnquiryService from "@/services/enquiry.service";
import * as AiService from "@/services/ai.service";
import type { RunAnalysisResult } from "@/services/ai.service";
import type { RecordActionResult } from "@/components/record-action-button";

export async function moveEnquiryAction(id: string, stage: string, index: number) {
  if (!(enquiryStages as readonly string[]).includes(stage)) throw new Error("Invalid stage");
  await EnquiryService.moveEnquiry(id, stage as (typeof enquiryStages)[number], index);
  revalidatePath("/enquiries");
}

export type FieldsFormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

function fieldErrors(e: import("zod").ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of e.errors) errors[String(issue.path[0])] = issue.message;
  return errors;
}

export async function updateEnquiryFieldsAction(id: string, _prev: FieldsFormState, formData: FormData): Promise<FieldsFormState> {
  const parsed = enquiryFieldsSchema.safeParse({
    stage: formData.get("stage") || undefined,
    priority: formData.get("priority") || undefined,
    assignedToId: formData.get("assignedToId") || undefined,
    estimatedValue: formData.get("estimatedValue") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below.", errors: fieldErrors(parsed.error) };

  const { stage, ...fields } = parsed.data;
  await EnquiryService.updateEnquiryFields(id, fields);
  if (stage) {
    const current = await EnquiryService.getEnquiry(id);
    if (current && current.stage !== stage) {
      // Changing stage here (rather than by dragging on the board) appends
      // to the end of the destination column — kanbanOrder stays consistent.
      await EnquiryService.moveEnquiry(id, stage, Number.MAX_SAFE_INTEGER);
    }
  }
  revalidatePath(`/enquiries/${id}`);
  revalidatePath("/enquiries");
  return { ok: true, message: "Saved" };
}

export async function linkToCustomerAction(enquiryId: string, customerId: string): Promise<RecordActionResult> {
  try {
    const result = await EnquiryService.convertToExistingCustomer(enquiryId, customerId);
    revalidatePath(`/enquiries/${enquiryId}`);
    revalidatePath("/enquiries");
    revalidatePath("/customers");
    return { ok: true, message: result.alreadyConverted ? "Already linked to a customer" : "Linked to customer" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to link enquiry to customer" };
  }
}

export async function createCustomerFromEnquiryAction(enquiryId: string): Promise<RecordActionResult> {
  try {
    const result = await EnquiryService.convertToNewCustomer(enquiryId);
    revalidatePath(`/enquiries/${enquiryId}`);
    revalidatePath("/enquiries");
    revalidatePath("/customers");
    return { ok: true, message: result.alreadyConverted ? "Already converted to a customer" : "Customer created" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to convert enquiry" };
  }
}

export async function runAiAnalysisAction(enquiryId: string): Promise<RunAnalysisResult> {
  const result = await AiService.runEnquiryAnalysis(enquiryId);
  revalidatePath(`/enquiries/${enquiryId}`);
  return result;
}

export type AiFieldsFormState = { ok: boolean; message: string } | null;

export async function updateAiAnalysisFieldsAction(enquiryId: string, _prev: AiFieldsFormState, formData: FormData): Promise<AiFieldsFormState> {
  const parsed = aiAnalysisFieldsSchema.safeParse({
    jobSummary: formData.get("jobSummary"),
    estimatedWork: formData.get("estimatedWork"),
    estimatedMetres: formData.get("estimatedMetres") || undefined,
    suggestedLabourHrs: formData.get("suggestedLabourHrs") || undefined,
    quoteNotes: formData.get("quoteNotes") || undefined,
    suggestedColours: formData.getAll("suggestedColours").map(String).filter(Boolean),
    suggestedProducts: formData.getAll("suggestedProducts").map(String).filter(Boolean),
    mould: formData.get("mould") === "on",
    missingSilicone: formData.get("missingSilicone") === "on",
    crackedSilicone: formData.get("crackedSilicone") === "on",
    waterIngress: formData.get("waterIngress") === "on",
    tileGaps: formData.get("tileGaps") === "on",
    groutCondition: formData.get("groutCondition") || undefined,
    cleanliness: formData.get("cleanliness") || undefined,
    safetyIssues: formData.get("safetyIssues") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please fix the errors below." };

  const d = parsed.data;
  await AiService.updateAIAnalysisFields(enquiryId, {
    jobSummary: d.jobSummary,
    estimatedWork: d.estimatedWork,
    estimatedMetres: d.estimatedMetres ?? null,
    suggestedLabourHrs: d.suggestedLabourHrs ?? null,
    quoteNotes: d.quoteNotes || null,
    suggestedColours: d.suggestedColours,
    suggestedProducts: d.suggestedProducts.map((label) => ({ label })),
    findings: {
      mould: d.mould,
      missingSilicone: d.missingSilicone,
      crackedSilicone: d.crackedSilicone,
      waterIngress: d.waterIngress,
      tileGaps: d.tileGaps,
      groutCondition: d.groutCondition,
      cleanliness: d.cleanliness,
      safetyIssues: d.safetyIssues ? d.safetyIssues.split("\n").map((s) => s.trim()).filter(Boolean) : [],
    },
  });

  revalidatePath(`/enquiries/${enquiryId}`);
  return { ok: true, message: "Saved" };
}
