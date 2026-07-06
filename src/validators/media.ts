import { z } from "zod";

// Categories staff can pick when uploading a document to the vault.
// QUOTE_PDF / INVOICE_PDF / CERTIFICATE are auto-generated elsewhere and
// never chosen manually — see media.service.ts's listDocuments.
export const documentCategories = ["RAMS", "RISK_ASSESSMENT", "METHOD_STATEMENT", "INSURANCE", "RECEIPT", "OTHER"] as const;

export const documentCategoryLabels: Record<(typeof documentCategories)[number], string> = {
  RAMS: "RAMS",
  RISK_ASSESSMENT: "Risk assessment",
  METHOD_STATEMENT: "Method statement",
  INSURANCE: "Insurance",
  RECEIPT: "Receipt",
  OTHER: "Other",
};

// Every category the vault might display, including the auto-generated ones.
export const allDocumentCategoryLabels: Record<string, string> = {
  ...documentCategoryLabels,
  QUOTE_PDF: "Quote",
  INVOICE_PDF: "Invoice",
  CERTIFICATE: "Warranty certificate",
};

export const uploadDocumentSchema = z.object({
  customerId: z.string().optional(),
  jobId: z.string().optional(),
  category: z.enum(documentCategories),
  url: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.coerce.number().int().nonnegative(),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const pairPhotosSchema = z.object({
  photoId: z.string().min(1),
  pairWithId: z.string().min(1),
});
export type PairPhotosInput = z.infer<typeof pairPhotosSchema>;
