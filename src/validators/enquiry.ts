import { z } from "zod";
import { propertyTypes } from "@/validators/customer";

export const workTypes = [
  "BATHROOM",
  "KITCHEN",
  "SHOWER",
  "EXTERNAL_WINDOWS",
  "EXPANSION_JOINTS",
  "FIRE_SEALANT",
  "CUT_OUT_RESEAL",
  "NEW_SILICONE",
  "OTHER",
] as const;

export const workTypeLabels: Record<(typeof workTypes)[number], string> = {
  BATHROOM: "Bathroom",
  KITCHEN: "Kitchen",
  SHOWER: "Shower",
  EXTERNAL_WINDOWS: "External windows",
  EXPANSION_JOINTS: "Expansion joints",
  FIRE_SEALANT: "Fire sealant",
  CUT_OUT_RESEAL: "Cut out & reseal",
  NEW_SILICONE: "New silicone",
  OTHER: "Other",
};

export const contactMethods = ["PHONE", "EMAIL", "SMS", "WHATSAPP"] as const;
export const contactMethodLabels: Record<(typeof contactMethods)[number], string> = {
  PHONE: "Phone",
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

export const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const priorityLabels: Record<(typeof priorities)[number], string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};
export const priorityDotClass: Record<(typeof priorities)[number], string> = {
  LOW: "bg-slate-400",
  NORMAL: "bg-sky-500",
  HIGH: "bg-amber-500",
  URGENT: "bg-red-600",
};

export const enquiryStages = [
  "NEW",
  "CONTACTED",
  "SITE_VISIT_BOOKED",
  "QUOTED",
  "WAITING_DECISION",
  "ACCEPTED",
  "REJECTED",
  "BOOKED",
  "COMPLETED",
  "FOLLOW_UP",
] as const;

export const enquiryStageLabels: Record<(typeof enquiryStages)[number], string> = {
  NEW: "New Enquiry",
  CONTACTED: "Contacted",
  SITE_VISIT_BOOKED: "Site Visit Booked",
  QUOTED: "Quoted",
  WAITING_DECISION: "Waiting Decision",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  BOOKED: "Booked",
  COMPLETED: "Completed",
  FOLLOW_UP: "Follow-up",
};

// Descriptor for a file already uploaded to R2 (or, until R2 is wired, this
// array is simply always empty — see src/lib/storage/r2.ts).
export const uploadedFileSchema = z.object({
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative().default(0),
  kind: z.enum(["PHOTO", "VIDEO"]),
});

export const publicEnquirySchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().optional(),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Enter a valid email"),
  addressText: z.string().min(1, "Address is required"),
  postcode: z.string().min(1, "Postcode is required"),
  propertyType: z.enum(propertyTypes).default("RESIDENTIAL"),
  workTypes: z.array(z.enum(workTypes)).min(1, "Select at least one type of work"),
  description: z.string().min(1, "Please describe the work"),
  preferredContact: z.enum(contactMethods).default("PHONE"),
  preferredDate: z.coerce.date().optional(),
  consentGiven: z.boolean().refine((v) => v === true, { message: "Consent is required to submit this form" }),
  files: z.array(uploadedFileSchema).default([]),
});

export type PublicEnquiryInput = z.infer<typeof publicEnquirySchema>;
export type UploadedFileInput = z.infer<typeof uploadedFileSchema>;

// Anti-bot fields carried alongside the enquiry payload but never persisted.
export const publicEnquiryRequestSchema = publicEnquirySchema.extend({
  website: z.string().optional(), // honeypot — real users never fill this in; route checks it's empty
  formRenderedAt: z.number().int().positive(),
});

export const enquiryFieldsSchema = z.object({
  stage: z.enum(enquiryStages).optional(),
  priority: z.enum(priorities).optional(),
  assignedToId: z.string().optional(),
  estimatedValue: z.coerce.number().nonnegative().optional(),
});

export type EnquiryFieldsInput = z.infer<typeof enquiryFieldsSchema>;
