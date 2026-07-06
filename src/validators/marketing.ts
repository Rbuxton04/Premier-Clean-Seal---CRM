import { z } from "zod";
import { workTypes } from "@/validators/enquiry";

export const marketingTones = ["PROFESSIONAL", "FRIENDLY", "LUXURY", "COMMERCIAL", "HOTELS", "RESIDENTIAL"] as const;
export const marketingToneLabels: Record<(typeof marketingTones)[number], string> = {
  PROFESSIONAL: "Professional",
  FRIENDLY: "Friendly",
  LUXURY: "Luxury",
  COMMERCIAL: "Commercial",
  HOTELS: "Hotels",
  RESIDENTIAL: "Residential",
};

export const marketingChannels = ["EMAIL", "SMS", "FACEBOOK", "INSTAGRAM", "LINKEDIN", "GOOGLE_BUSINESS_PROFILE"] as const;
export const marketingChannelLabels: Record<(typeof marketingChannels)[number], string> = {
  EMAIL: "Email",
  SMS: "SMS",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  GOOGLE_BUSINESS_PROFILE: "Google Business Profile",
};

// Guidance handed to the AI writer's system prompt — length + hashtag rules per channel.
export const marketingChannelRules: Record<(typeof marketingChannels)[number], string> = {
  EMAIL: "Write a warm, complete email body of 120-220 words. No hashtags.",
  SMS: "Maximum 160 characters including merge fields. Plain text, no hashtags, no emoji.",
  FACEBOOK: "80-150 words, conversational, end with 2-4 relevant hashtags.",
  INSTAGRAM: "Short, visual caption of 40-100 words, end with 3-6 relevant hashtags.",
  LINKEDIN: "Professional tone, 60-120 words, 0-2 hashtags at most.",
  GOOGLE_BUSINESS_PROFILE: "Factual short update, maximum 300 characters, no hashtags.",
};

export const generateCampaignSchema = z.object({
  tone: z.enum(marketingTones),
  channel: z.enum(marketingChannels),
  brief: z.string().min(1, "Describe what this campaign is about"),
  name: z.string().optional(),
});
export type GenerateCampaignInput = z.infer<typeof generateCampaignSchema>;

export const reminderStatuses = [
  "SCHEDULED", "SENT", "OPENED", "CLICKED", "REPLIED", "CONVERTED", "FAILED", "CANCELLED", "UNSUBSCRIBED",
] as const;

export const reminderStatusLabels: Record<(typeof reminderStatuses)[number], string> = {
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  OPENED: "Opened",
  CLICKED: "Clicked",
  REPLIED: "Replied",
  CONVERTED: "Converted",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  UNSUBSCRIBED: "Unsubscribed",
};

export const reminderStatusBadgeVariant: Record<(typeof reminderStatuses)[number], "default" | "secondary" | "outline" | "success" | "warning"> = {
  SCHEDULED: "secondary",
  SENT: "default",
  OPENED: "default",
  CLICKED: "success",
  REPLIED: "success",
  CONVERTED: "success",
  FAILED: "warning",
  CANCELLED: "outline",
  UNSUBSCRIBED: "outline",
};

export const rescheduleReminderSchema = z.object({
  dueDate: z.coerce.date(),
});
export type RescheduleReminderInput = z.infer<typeof rescheduleReminderSchema>;

export const rebookingRequestSchema = z.object({
  propertyId: z.string().min(1, "Select a property"),
  workTypes: z.array(z.enum(workTypes)).min(1, "Select at least one type of work"),
  description: z.string().min(1, "Please describe the work"),
  reminderId: z.string().optional(),
});
export type RebookingRequestInput = z.infer<typeof rebookingRequestSchema>;
