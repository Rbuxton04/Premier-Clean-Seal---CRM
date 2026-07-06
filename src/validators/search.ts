import { z } from "zod";

// The AI adapter (when enabled) turns a plain-English question into this
// shape via tool-calling — see src/lib/ai/provider.ts's parseSearchQuery.
// This Zod schema is the security boundary described in the Milestone 10
// brief: whatever the model emits is validated here before search.service.ts
// ever compiles it into a Prisma query. Nothing the AI emits is ever
// executed directly — only fields that pass this schema are used, and even
// then only to build a whitelisted set of Prisma filters (see
// search.service.ts's normalizeEnum + per-entity where-builders).
export const searchEntities = ["jobs", "customers", "properties", "enquiries"] as const;
export type SearchEntity = (typeof searchEntities)[number];

export const searchEntityLabels: Record<SearchEntity, string> = {
  jobs: "Jobs",
  customers: "Customers",
  properties: "Properties",
  enquiries: "Enquiries",
};

// Most filter fields are kept as free strings (not z.enum) even though several
// map to real schema enums (WorkType, ApplicationArea, PropertyType, JobStatus,
// EnquiryStage) — the AI may phrase a value slightly differently ("cut out and
// reseal" vs "CUT_OUT_RESEAL"), and search.service.ts's normalizeEnum() does the
// tolerant matching. A field that doesn't match a known enum is simply ignored
// rather than failing the whole parse.
export const searchFiltersSchema = z.object({
  workType: z.string().nullish(),
  applicationArea: z.string().nullish(),
  propertyType: z.string().nullish(),
  tag: z.string().nullish(),
  colour: z.string().nullish(),
  product: z.string().nullish(),
  manufacturer: z.string().nullish(),
  technician: z.string().nullish(),
  status: z.string().nullish(),
  mouldFound: z.boolean().nullish(),
  dueFollowUp: z.boolean().nullish(),
  completedBefore: z.coerce.date().nullish(),
  completedAfter: z.coerce.date().nullish(),
  createdBefore: z.coerce.date().nullish(),
  createdAfter: z.coerce.date().nullish(),
  postcodeStartsWith: z.string().nullish(),
  textContains: z.string().nullish(),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const searchQuerySchema = z.object({
  entity: z.enum(searchEntities),
  filters: searchFiltersSchema.default({}),
  sort: z.enum(["newest", "oldest"]).nullish(),
  clarification: z.string().nullish(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

const FILTER_LABELS: Record<keyof SearchFilters, string> = {
  workType: "Work type",
  applicationArea: "Area",
  propertyType: "Property type",
  tag: "Tag",
  colour: "Colour",
  product: "Product",
  manufacturer: "Manufacturer",
  technician: "Technician",
  status: "Status",
  mouldFound: "Mould found",
  dueFollowUp: "Due follow-up",
  completedBefore: "Completed before",
  completedAfter: "Completed after",
  createdBefore: "Created before",
  createdAfter: "Created after",
  postcodeStartsWith: "Postcode starts with",
  textContains: "Contains",
};

export type FilterChip = { key: keyof SearchFilters; label: string; value: string };

/** Renders the parsed query as human-readable chips for the "Understood as" row. */
export function describeQuery(query: SearchQuery): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const key of Object.keys(query.filters) as Array<keyof SearchFilters>) {
    const value = query.filters[key];
    if (value === null || value === undefined || value === "") continue;
    const display =
      value instanceof Date
        ? value.toLocaleDateString("en-GB")
        : typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : String(value);
    chips.push({ key, label: FILTER_LABELS[key], value: display });
  }
  return chips;
}
