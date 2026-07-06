import { z } from "zod";
import { workTypes } from "@/validators/enquiry";

export const sendPortalLinkSchema = z.object({
  expiryDays: z.coerce.number().int().min(7).max(365).default(60),
});
export type SendPortalLinkInput = z.infer<typeof sendPortalLinkSchema>;

export const portalContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
});
export type PortalContactInput = z.infer<typeof portalContactSchema>;

export const portalMessageSchema = z.object({
  message: z.string().min(1, "Please enter a message").max(2000, "Please keep it under 2000 characters"),
});
export type PortalMessageInput = z.infer<typeof portalMessageSchema>;

export const portalRequestKinds = ["quote", "maintenance"] as const;
export type PortalRequestKind = (typeof portalRequestKinds)[number];

export const portalRequestSchema = z.object({
  propertyId: z.string().min(1, "Select a property"),
  workTypes: z.array(z.enum(workTypes)).min(1, "Select at least one type of work"),
  description: z.string().min(1, "Please describe what you need"),
});
export type PortalRequestInput = z.infer<typeof portalRequestSchema>;

export const portalApprovalSchema = z.object({
  name: z.string().min(1, "Please type your name to approve"),
});

export const portalRejectSchema = z.object({
  reason: z.string().optional(),
});
