import type { TakeoffMeasurementType } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID, getOrgSettings } from "@/lib/settings";
import { getFileUrl } from "@/lib/storage/supabase";
import { resolvePointsPerMetre, computeMeasurementMetres, type TakeoffScaleInput, type TakeoffCreateInput, type TakeoffItemInput, type TakeoffMeasurementInput, type Point } from "@/validators/takeoff";

// Explicit hand-written return types -- see the Prisma typing note in customer.service.ts.

/** Resolves a stored storage path to a viewable signed URL -- same pattern as media.service.ts / certification.service.ts. */
async function resolveFileUrl(path: string): Promise<string> {
  return (await getFileUrl(path)) ?? path;
}

// ---------------------------------------------------------------------------
// List / detail
// ---------------------------------------------------------------------------

export type TakeoffListItem = {
  id: string;
  name: string;
  scaleRatioLabel: string | null;
  customer: { id: string; name: string } | null;
  job: { id: string; jobNumber: string } | null;
  quote: { id: string; quoteNumber: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TakeoffFilters = { customerId?: string; jobId?: string; quoteId?: string };

export async function listTakeoffs(filters: TakeoffFilters = {}): Promise<TakeoffListItem[]> {
  const { customerId, jobId, quoteId } = filters;
  const rows = await db.takeoff.findMany({
    where: {
      organisationId: ORG_ID,
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(jobId ? { jobId } : {}),
      ...(quoteId ? { quoteId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      job: { select: { id: true, jobNumber: true } },
      quote: { select: { id: true, quoteNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows as TakeoffListItem[];
}

export type TakeoffMeasurementItem = {
  id: string;
  pageNumber: number;
  type: TakeoffMeasurementType;
  points: Point[];
  computedMetres: unknown;
  label: string | null;
};

export type TakeoffItemDetail = {
  id: string;
  name: string;
  colour: string;
  pricePerMetre: unknown;
  sortOrder: number;
  measurements: TakeoffMeasurementItem[];
  totalMetres: number;
  lineTotalGbp: number;
};

export type TakeoffDetail = {
  id: string;
  name: string;
  pdfFileUrl: string;
  pageCount: number | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  jobId: string | null;
  quoteId: string | null;
  pointsPerMetre: number;
  scaleRatioLabel: string | null;
  items: TakeoffItemDetail[];
  totalMetres: number;
  grandTotalGbp: number;
  createdAt: Date;
  updatedAt: Date;
};

function summariseItem(item: {
  id: string; name: string; colour: string; pricePerMetre: unknown; sortOrder: number;
  measurements: Array<{ id: string; pageNumber: number; type: TakeoffMeasurementType; points: unknown; computedMetres: unknown; label: string | null }>;
}): TakeoffItemDetail {
  const totalMetres = +item.measurements.reduce((sum, m) => sum + Number(m.computedMetres), 0).toFixed(2);
  return {
    id: item.id,
    name: item.name,
    colour: item.colour,
    pricePerMetre: item.pricePerMetre,
    sortOrder: item.sortOrder,
    measurements: item.measurements.map((m) => ({
      id: m.id, pageNumber: m.pageNumber, type: m.type, points: m.points as unknown as Point[],
      computedMetres: m.computedMetres, label: m.label,
    })),
    totalMetres,
    lineTotalGbp: +(totalMetres * Number(item.pricePerMetre)).toFixed(2),
  };
}

export async function getTakeoff(id: string): Promise<TakeoffDetail | null> {
  const row = await db.takeoff.findFirst({
    where: { id, organisationId: ORG_ID, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { measurements: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!row) return null;

  const items = row.items.map(summariseItem);
  return {
    id: row.id,
    name: row.name,
    pdfFileUrl: await resolveFileUrl(row.pdfFileUrl),
    pageCount: row.pageCount,
    customerId: row.customerId,
    customer: row.customer,
    jobId: row.jobId,
    quoteId: row.quoteId,
    pointsPerMetre: row.pointsPerMetre,
    scaleRatioLabel: row.scaleRatioLabel,
    items,
    totalMetres: +items.reduce((sum, i) => sum + i.totalMetres, 0).toFixed(2),
    grandTotalGbp: +items.reduce((sum, i) => sum + i.lineTotalGbp, 0).toFixed(2),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type TakeoffExportDetail = {
  id: string;
  name: string;
  /** The RAW storage path, not a signed URL -- the export route downloads the source bytes server-side via downloadObject(), it never needs a browser-facing link. */
  pdfFilePath: string;
  customer: { id: string; name: string; company: string | null } | null;
  pointsPerMetre: number;
  scaleRatioLabel: string | null;
  items: TakeoffItemDetail[];
  totalMetres: number;
  grandTotalGbp: number;
  createdAt: Date;
};

/** Same shape as getTakeoff(), but with the takeoff's raw PDF storage path instead of a resolved signed URL -- for the marked-up-plan export route, which reads the source file itself server-side. */
export async function getTakeoffForExport(id: string): Promise<TakeoffExportDetail | null> {
  const row = await db.takeoff.findFirst({
    where: { id, organisationId: ORG_ID, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { measurements: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!row) return null;

  const items = row.items.map(summariseItem);
  return {
    id: row.id,
    name: row.name,
    pdfFilePath: row.pdfFileUrl,
    customer: row.customer,
    pointsPerMetre: row.pointsPerMetre,
    scaleRatioLabel: row.scaleRatioLabel,
    items,
    totalMetres: +items.reduce((sum, i) => sum + i.totalMetres, 0).toFixed(2),
    grandTotalGbp: +items.reduce((sum, i) => sum + i.lineTotalGbp, 0).toFixed(2),
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Takeoff CRUD
// ---------------------------------------------------------------------------

export async function createTakeoff(data: TakeoffCreateInput): Promise<{ id: string }> {
  const { pointsPerMetre, scaleRatioLabel } = resolvePointsPerMetre(data.scale);
  return db.takeoff.create({
    data: {
      organisationId: ORG_ID,
      name: data.name,
      pdfFileUrl: data.pdfFileUrl,
      pageCount: data.pageCount ?? null,
      customerId: data.customerId || null,
      jobId: data.jobId || null,
      quoteId: data.quoteId || null,
      pointsPerMetre,
      scaleRatioLabel,
    },
    select: { id: true },
  });
}

export async function updateTakeoffDetails(id: string, data: { name?: string; customerId?: string | null; jobId?: string | null; quoteId?: string | null }): Promise<void> {
  await db.takeoff.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.customerId !== undefined ? { customerId: data.customerId || null } : {}),
      ...(data.jobId !== undefined ? { jobId: data.jobId || null } : {}),
      ...(data.quoteId !== undefined ? { quoteId: data.quoteId || null } : {}),
    },
  });
}

/**
 * Changing the scale recomputes every existing measurement's stored
 * computedMetres from its unchanged point-space points -- the brief
 * requires existing measurements to recompute when the scale changes, and
 * computedMetres is a cached figure (so totals don't need to re-walk raw
 * points on every read), so it has to be refreshed here rather than left
 * stale.
 */
export async function updateTakeoffScale(id: string, scale: TakeoffScaleInput): Promise<void> {
  const { pointsPerMetre, scaleRatioLabel } = resolvePointsPerMetre(scale);
  const measurements = await db.takeoffMeasurement.findMany({
    where: { takeoffItem: { takeoffId: id } },
    select: { id: true, points: true },
  });

  await db.$transaction([
    db.takeoff.update({ where: { id }, data: { pointsPerMetre, scaleRatioLabel } }),
    ...measurements.map((m) =>
      db.takeoffMeasurement.update({
        where: { id: m.id },
        data: { computedMetres: computeMeasurementMetres(m.points as unknown as Point[], pointsPerMetre) },
      })
    ),
  ]);
}

/**
 * Soft-delete -- mirrors Certification.deletedAt. Items/measurements are
 * left in place (cascade only on an actual DB-level hard delete, which the
 * app never does) so restoring a takeoff brings everything back intact.
 */
export async function softDeleteTakeoff(id: string, userId: string | null): Promise<void> {
  await db.takeoff.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } });
}

export async function restoreTakeoff(id: string): Promise<void> {
  await db.takeoff.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function createTakeoffItem(takeoffId: string, data: TakeoffItemInput): Promise<{ id: string }> {
  return db.takeoffItem.create({
    data: { takeoffId, name: data.name, colour: data.colour, pricePerMetre: data.pricePerMetre, sortOrder: data.sortOrder },
    select: { id: true },
  });
}

export async function updateTakeoffItem(id: string, data: TakeoffItemInput): Promise<void> {
  await db.takeoffItem.update({
    where: { id },
    data: { name: data.name, colour: data.colour, pricePerMetre: data.pricePerMetre, sortOrder: data.sortOrder },
  });
}

/** Hard delete -- items/measurements aren't independently meaningful records (see the schema comment on TakeoffItem), cascades its measurements. */
export async function deleteTakeoffItem(id: string): Promise<void> {
  await db.takeoffItem.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

export async function createMeasurement(data: TakeoffMeasurementInput, pointsPerMetre: number): Promise<{ id: string; computedMetres: number }> {
  const computedMetres = computeMeasurementMetres(data.points, pointsPerMetre);
  const row = await db.takeoffMeasurement.create({
    data: {
      takeoffItemId: data.takeoffItemId,
      pageNumber: data.pageNumber,
      type: data.type,
      points: data.points,
      computedMetres,
      label: data.label || null,
    },
    select: { id: true },
  });
  return { id: row.id, computedMetres };
}

export async function updateMeasurementLabel(id: string, label: string | null): Promise<void> {
  await db.takeoffMeasurement.update({ where: { id }, data: { label } });
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.takeoffMeasurement.delete({ where: { id } });
}

/** "Clear all" -- every measurement across every item on this takeoff. The items themselves (and their colours/rates) are kept. */
export async function clearAllMeasurements(takeoffId: string): Promise<void> {
  await db.takeoffMeasurement.deleteMany({ where: { takeoffItem: { takeoffId } } });
}

// ---------------------------------------------------------------------------
// Feeding into the existing quote builder -- see buildDraftFromEnquiry in
// quote.service.ts for the precedent this mirrors. Returns the SAME
// QuoteDraft shape so quotes/new/page.tsx can prefill the existing builder
// with it rather than a parallel creation path.
// ---------------------------------------------------------------------------

export type TakeoffQuoteDraft = {
  customerId: string;
  scopeOfWorks: string;
  terms: string;
  warrantyMonths: number;
  lineItems: Array<{ description: string; quantity: number; unit: string; unitPrice: number }>;
};

export async function buildDraftFromTakeoff(takeoffId: string): Promise<TakeoffQuoteDraft | null> {
  const takeoff = await getTakeoff(takeoffId);
  if (!takeoff) return null;
  const org = await getOrgSettings();

  const lineItems = takeoff.items
    .filter((i) => i.totalMetres > 0)
    .map((i) => ({ description: i.name, quantity: i.totalMetres, unit: "m", unitPrice: Number(i.pricePerMetre) }));

  return {
    customerId: takeoff.customerId ?? "",
    scopeOfWorks: `Sealant works per the ${takeoff.name} plan takeoff.`,
    terms: "",
    warrantyMonths: org.defaultWarrantyMonths,
    lineItems: lineItems.length > 0 ? lineItems : [{ description: takeoff.name, quantity: 1, unit: "each", unitPrice: 0 }],
  };
}

/** Links a takeoff to the quote just created from it, and backfills its customerId if it didn't have one yet -- see createQuoteAction's takeoffId handling. */
export async function linkTakeoffToQuote(takeoffId: string, quoteId: string, customerId: string): Promise<void> {
  await db.takeoff.update({ where: { id: takeoffId }, data: { quoteId, customerId } });
}
