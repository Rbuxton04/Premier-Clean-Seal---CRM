import type { Prisma, JobStatus, WorkType, ApplicationArea, PropertyType, EnquiryStage } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { isAiConfigured, getAiProvider } from "@/lib/ai";
import { listTags } from "@/services/tag.service";
import { listTechnicians } from "@/services/job.service";
import { searchQuerySchema, type SearchFilters, type SearchQuery } from "@/validators/search";
import { workTypes } from "@/validators/enquiry";
import { enquiryStages } from "@/validators/enquiry";
import { applicationAreas } from "@/validators/completion";
import { propertyTypes } from "@/validators/customer";
import { jobStatuses } from "@/validators/job";

// ---------------------------------------------------------------------------
// SECURITY BOUNDARY: this file is the only place a validated SearchQuery is
// ever turned into a real database query. The AI adapter (src/lib/ai) never
// sees a Prisma client and never produces SQL — it only fills in the small
// whitelisted SearchFilters shape, which src/validators/search.ts validates
// with Zod before it ever reaches here. Every function below additionally
// scopes to ORG_ID and only reads fields present on SearchFilters — there is
// no code path that takes a raw string from the AI and interpolates it into
// a query beyond a `contains`/`equals` filter value.
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 50;

/** Tolerantly matches a free-typed value (e.g. "cut out and reseal") against a known enum list. */
function normalizeEnum<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(upper) ? (upper as T) : null;
}

function dateRange(before?: Date | null, after?: Date | null): Prisma.DateTimeFilter | undefined {
  if (!before && !after) return undefined;
  return { ...(before ? { lte: before } : {}), ...(after ? { gte: after } : {}) };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type JobSearchResult = {
  id: string;
  jobNumber: string;
  status: string;
  scheduledStart: Date | null;
  actualEnd: Date | null;
  price: unknown;
  customer: { id: string; name: string };
  property: { id: string; postcode: string } | null;
  technician: { id: string; name: string } | null;
  materials: Array<{ applicationArea: string; product: { manufacturer: string; name: string; colour: string } }>;
};

async function searchJobs(filters: SearchFilters, sort: "newest" | "oldest" | undefined, limit: number): Promise<JobSearchResult[]> {
  const where: Prisma.JobWhereInput = { organisationId: ORG_ID, deletedAt: null };

  const status = normalizeEnum(filters.status, jobStatuses);
  if (status) where.status = status as JobStatus;

  if (filters.technician) where.technician = { name: { contains: filters.technician, mode: "insensitive" } };

  const completedRange = dateRange(filters.completedBefore, filters.completedAfter);
  if (completedRange) where.actualEnd = completedRange;
  const createdRange = dateRange(filters.createdBefore, filters.createdAfter);
  if (createdRange) where.createdAt = createdRange;

  const materialsSome: Prisma.MaterialUsageWhereInput = {};
  const applicationArea = normalizeEnum(filters.applicationArea, applicationAreas);
  if (applicationArea) materialsSome.applicationArea = applicationArea as ApplicationArea;

  const productWhere: Prisma.ProductWhereInput = {};
  if (filters.colour) productWhere.colour = { contains: filters.colour, mode: "insensitive" };
  if (filters.product) productWhere.name = { contains: filters.product, mode: "insensitive" };
  if (filters.manufacturer) productWhere.manufacturer = { contains: filters.manufacturer, mode: "insensitive" };
  if (Object.keys(productWhere).length > 0) materialsSome.product = productWhere;
  if (Object.keys(materialsSome).length > 0) where.materials = { some: materialsSome };

  const propertyWhere: Prisma.PropertyWhereInput = {};
  if (filters.postcodeStartsWith) propertyWhere.postcode = { startsWith: filters.postcodeStartsWith, mode: "insensitive" };
  const propertyType = normalizeEnum(filters.propertyType, propertyTypes);
  if (propertyType) propertyWhere.propertyType = propertyType as PropertyType;
  if (Object.keys(propertyWhere).length > 0) where.property = propertyWhere;

  if (filters.textContains) {
    where.OR = [
      { jobNumber: { contains: filters.textContains, mode: "insensitive" } },
      { notes: { contains: filters.textContains, mode: "insensitive" } },
      { customer: { name: { contains: filters.textContains, mode: "insensitive" } } },
    ];
  }

  const rows = await db.job.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      property: { select: { id: true, postcode: true } },
      technician: { select: { id: true, name: true } },
      materials: { select: { applicationArea: true, product: { select: { manufacturer: true, name: true, colour: true } } } },
    },
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    take: limit,
  });
  return rows as JobSearchResult[];
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type CustomerSearchResult = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  tags: Array<{ id: string; name: string; colour: string }>;
  _count: { jobs: number; properties: number };
};

async function searchCustomers(filters: SearchFilters, sort: "newest" | "oldest" | undefined, limit: number): Promise<CustomerSearchResult[]> {
  const where: Prisma.CustomerWhereInput = { organisationId: ORG_ID, deletedAt: null };

  if (filters.tag) where.tags = { some: { name: { contains: filters.tag, mode: "insensitive" } } };

  const propertyType = normalizeEnum(filters.propertyType, propertyTypes);
  if (filters.postcodeStartsWith || propertyType) {
    where.properties = {
      some: {
        deletedAt: null,
        ...(filters.postcodeStartsWith ? { postcode: { startsWith: filters.postcodeStartsWith, mode: "insensitive" } } : {}),
        ...(propertyType ? { propertyType: propertyType as PropertyType } : {}),
      },
    };
  }

  const createdRange = dateRange(filters.createdBefore, filters.createdAfter);
  if (createdRange) where.createdAt = createdRange;

  if (filters.dueFollowUp) {
    where.reminders = { some: { status: "SCHEDULED", dueDate: { lte: new Date() } } };
  }

  if (filters.textContains) {
    where.OR = [
      { name: { contains: filters.textContains, mode: "insensitive" } },
      { email: { contains: filters.textContains, mode: "insensitive" } },
      { phone: { contains: filters.textContains, mode: "insensitive" } },
      { company: { contains: filters.textContains, mode: "insensitive" } },
    ];
  }

  const rows = await db.customer.findMany({
    where,
    include: { tags: { select: { id: true, name: true, colour: true } }, _count: { select: { jobs: true, properties: { where: { deletedAt: null } } } } },
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    take: limit,
  });
  return rows as CustomerSearchResult[];
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export type PropertySearchResult = {
  id: string;
  addressLine1: string;
  postcode: string;
  propertyType: string;
  customer: { id: string; name: string };
};

async function searchProperties(filters: SearchFilters, sort: "newest" | "oldest" | undefined, limit: number): Promise<PropertySearchResult[]> {
  const where: Prisma.PropertyWhereInput = { customer: { organisationId: ORG_ID, deletedAt: null }, deletedAt: null };

  const propertyType = normalizeEnum(filters.propertyType, propertyTypes);
  if (propertyType) where.propertyType = propertyType as PropertyType;
  if (filters.postcodeStartsWith) where.postcode = { startsWith: filters.postcodeStartsWith, mode: "insensitive" };
  if (filters.mouldFound) {
    where.enquiries = { some: { aiAnalysis: { findings: { path: ["mould"], equals: true } } } };
  }

  if (filters.textContains) {
    where.OR = [
      { addressLine1: { contains: filters.textContains, mode: "insensitive" } },
      { postcode: { contains: filters.textContains, mode: "insensitive" } },
      { customer: { name: { contains: filters.textContains, mode: "insensitive" } } },
    ];
  }

  const rows = await db.property.findMany({
    where,
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    take: limit,
  });
  return rows as PropertySearchResult[];
}

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

export type EnquirySearchResult = {
  id: string;
  name: string;
  postcode: string;
  stage: string;
  description: string;
  createdAt: Date;
  customer: { id: string; name: string } | null;
};

async function searchEnquiries(filters: SearchFilters, sort: "newest" | "oldest" | undefined, limit: number): Promise<EnquirySearchResult[]> {
  const where: Prisma.EnquiryWhereInput = { organisationId: ORG_ID };

  const workType = normalizeEnum(filters.workType, workTypes);
  if (workType) where.workTypes = { has: workType as WorkType };

  const propertyType = normalizeEnum(filters.propertyType, propertyTypes);
  if (propertyType) where.propertyType = propertyType as PropertyType;

  if (filters.postcodeStartsWith) where.postcode = { startsWith: filters.postcodeStartsWith, mode: "insensitive" };

  const stage = normalizeEnum(filters.status, enquiryStages);
  if (stage) where.stage = stage as EnquiryStage;

  if (filters.mouldFound) {
    where.aiAnalysis = { findings: { path: ["mould"], equals: true } };
  }

  const createdRange = dateRange(filters.createdBefore, filters.createdAfter);
  if (createdRange) where.createdAt = createdRange;

  if (filters.textContains) {
    where.OR = [
      { description: { contains: filters.textContains, mode: "insensitive" } },
      { name: { contains: filters.textContains, mode: "insensitive" } },
      { postcode: { contains: filters.textContains, mode: "insensitive" } },
    ];
  }

  const rows = await db.enquiry.findMany({
    where,
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    take: limit,
  });
  return rows as EnquirySearchResult[];
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export type SearchResults =
  | { entity: "jobs"; items: JobSearchResult[] }
  | { entity: "customers"; items: CustomerSearchResult[] }
  | { entity: "properties"; items: PropertySearchResult[] }
  | { entity: "enquiries"; items: EnquirySearchResult[] };

export async function runSearch(query: SearchQuery, limit = DEFAULT_LIMIT): Promise<SearchResults> {
  const sort = query.sort ?? undefined;
  switch (query.entity) {
    case "jobs":
      return { entity: "jobs", items: await searchJobs(query.filters, sort, limit) };
    case "customers":
      return { entity: "customers", items: await searchCustomers(query.filters, sort, limit) };
    case "properties":
      return { entity: "properties", items: await searchProperties(query.filters, sort, limit) };
    case "enquiries":
      return { entity: "enquiries", items: await searchEnquiries(query.filters, sort, limit) };
  }
}

// ---------------------------------------------------------------------------
// Natural-language entry point — AI parse (validated) with a keyword fallback
// ---------------------------------------------------------------------------

export type SearchOutcome = {
  query: SearchQuery;
  results: SearchResults;
  understood: boolean;
  clarification?: string;
};

function keywordFallbackQuery(question: string): SearchQuery {
  return { entity: "customers", filters: { textContains: question }, sort: undefined, clarification: undefined };
}

async function runKeywordFallback(question: string): Promise<SearchOutcome> {
  const query = keywordFallbackQuery(question);
  return { query, results: await runSearch(query), understood: false };
}

/** The only entry point that touches the AI adapter for search — everything downstream is validated. */
export async function parseAndSearch(question: string): Promise<SearchOutcome> {
  if (!isAiConfigured()) return runKeywordFallback(question);

  try {
    const [tags, technicians] = await Promise.all([listTags(), listTechnicians()]);
    const provider = getAiProvider();
    const raw = await provider.parseSearchQuery({
      question,
      todayIso: new Date().toISOString().slice(0, 10),
      tags: tags.map((t) => t.name),
      technicians: technicians.map((t) => t.name),
    });

    const parsed = searchQuerySchema.safeParse(raw);
    if (!parsed.success) return runKeywordFallback(question);

    if (parsed.data.clarification) {
      return { query: parsed.data, results: { entity: parsed.data.entity, items: [] } as SearchResults, understood: true, clarification: parsed.data.clarification };
    }

    return { query: parsed.data, results: await runSearch(parsed.data), understood: true };
  } catch (err) {
    console.error("AI search parse failed, falling back to a keyword search", err);
    return runKeywordFallback(question);
  }
}
