import { z } from "zod";

export const certOwnerTypes = ["BUSINESS", "PERSON"] as const;
export const certOwnerTypeLabels: Record<(typeof certOwnerTypes)[number], string> = {
  BUSINESS: "Business",
  PERSON: "Person",
};

// Suggestions only, not a closed enum -- category is a free-text column
// (see the schema comment on Certification.category) so a new kind of
// record never needs a migration. Offered to the category Combobox the same
// way validators/media.ts offers document categories.
export const certCategorySuggestions = ["Insurance", "CSCS", "DBS", "Accreditation", "Training", "Other"] as const;

export const certificationSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    category: z.string().min(1, "Category is required"),
    ownerType: z.enum(certOwnerTypes),
    userId: z.string().optional(),
    issueDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date(),
    reference: z.string().optional(),
    fileUrl: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.ownerType !== "PERSON" || !!data.userId, {
    message: "Choose who this certification belongs to",
    path: ["userId"],
  });
export type CertificationInput = z.infer<typeof certificationSchema>;

export const certStatuses = ["EXPIRED", "EXPIRING_SOON", "UPCOMING", "VALID"] as const;
export type CertStatus = (typeof certStatuses)[number];

export const certStatusLabels: Record<CertStatus, string> = {
  EXPIRED: "Expired",
  EXPIRING_SOON: "Expiring soon",
  UPCOMING: "Upcoming",
  VALID: "Valid",
};

export const certStatusBadgeVariant: Record<CertStatus, "danger" | "warning" | "outline" | "success"> = {
  EXPIRED: "danger",
  EXPIRING_SOON: "warning",
  UPCOMING: "outline",
  VALID: "success",
};
