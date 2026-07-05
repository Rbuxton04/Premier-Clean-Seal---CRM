import { z } from "zod";

export const propertyTypes = ["RESIDENTIAL", "COMMERCIAL", "HOTEL", "OFFICE", "HOSPITAL", "OTHER"] as const;

export const propertySchema = z.object({
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().min(1, "Postcode is required"),
  propertyType: z.enum(propertyTypes).default("RESIDENTIAL"),
  notes: z.string().optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().optional(),
  marketingEmail: z.boolean().default(false),
  marketingSms: z.boolean().default(false),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;

export const propertyTypeLabels: Record<(typeof propertyTypes)[number], string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  HOTEL: "Hotel",
  OFFICE: "Office",
  HOSPITAL: "Hospital",
  OTHER: "Other",
};
