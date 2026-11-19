import type { TakeoffMeasurementType, TakeoffItemKind } from "@prisma/client";
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
  // Which file (of the takeoff's possibly several) pageNumber is relative
  // to -- null means "the takeoff's first file", the same safety-net
  // convention the schema comment on TakeoffMeasurement.takeoffFileId
  // documents (every pre-Step-4 row was backfilled to a real id; this
  // only stays null if something failed to set it).
  takeoffFileId: string | null;
  type: TakeoffMeasurementType;
  points: Point[];
  computedMetres: unknown;
  label: string | null;
};

export type TakeoffFileItem = {
  id: string;
  name: string;
  pageCount: number | null;
  pointsPerMetre: number | null;
  sortOrder: number;
};

export type TakeoffItemDetail = {
  id: string;
  name: string;
  colour: string;
  // LENGTH (default) is priced per metre; COUNT (Drawings Part 2) per
  // item -- see the schema comment on TakeoffItem.pricePerMetre.
  kind: TakeoffItemKind;
  pricePerMetre: unknown;
  sortOrder: number;
  // Worst-case materials overrides -- LENGTH items only; null means "use
  // the organisation default" for that figure.
  overrideJointWidthMm: number | null;
  overrideJointDepthMm: number | null;
  overrideWastePercent: number | null;
  measurements: TakeoffMeasurementItem[];
  /** 0 for a COUNT item. */
  totalMetres: number;
  /** Number of COUNT markers; 0 for a LENGTH item. */
  count: number;
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
  /** Every file on this drawing (Drawings Part 1 Step 4) -- the viewer streams each one's bytes on demand via /api/takeoffs/[id]/file?fileId=..., never a resolved URL here. */
  files: TakeoffFileItem[];
  totalMetres: number;
  grandTotalGbp: number;
  createdAt: Date;
  updatedAt: Date;
};

function summariseItem(item: {
  id: string; name: string; colour: string; kind: TakeoffItemKind; pricePerMetre: unknown; sortOrder: number;
  overrideJointWidthMm: number | null; overrideJointDepthMm: number | null; overrideWastePercent: number | null;
  measurements: Array<{ id: string; pageNumber: number; takeoffFileId: string | null; type: TakeoffMeasurementType; points: unknown; computedMetres: unknown; label: string | null }>;
}): TakeoffItemDetail {
  // A COUNT item's "quantity" is how many markers it has, not a summed
  // distance -- its measurements' computedMetres is always 0 (a single
  // point has no length) and is never summed into totalMetres.
  const totalMetres = item.kind === "COUNT" ? 0 : +item.measurements.reduce((sum, m) => sum + Number(m.computedMetres), 0).toFixed(2);
  const count = item.kind === "COUNT" ? item.measurements.length : 0;
  const quantity = item.kind === "COUNT" ? count : totalMetres;
  return {
    id: item.id,
    name: item.name,
    colour: item.colour,
    kind: item.kind,
    pricePerMetre: item.pricePerMetre,
    sortOrder: item.sortOrder,
    overrideJointWidthMm: item.overrideJointWidthMm,
    overrideJointDepthMm: item.overrideJointDepthMm,
    overrideWastePercent: item.overrideWastePercent,
    measurements: item.measurements.map((m) => ({
      id: m.id, pageNumber: m.pageNumber, takeoffFileId: m.takeoffFileId, type: m.type, points: m.points as unknown as Point[],
      computedMetres: m.computedMetres, label: m.label,
    })),
    totalMetres,
    count,
    lineTotalGbp: +(quantity * Number(item.pricePerMetre)).toFixed(2),
  };
}

function summariseFile(file: { id: string; name: string; pageCount: number | null; pointsPerMetre: number | null; sortOrder: number }): TakeoffFileItem {
  return { id: file.id, name: file.name, pageCount: file.pageCount, pointsPerMetre: file.pointsPerMetre, sortOrder: file.sortOrder };
}

export async function getTakeoff(id: string): Promise<TakeoffDetail | null> {
  const row = await db.takeoff.findFirst({
    where: { id, organisationId: ORG_ID, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { measurements: { orderBy: { createdAt: "asc" } } } },
      files: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
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
    files: row.files.map(summariseFile),
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

/**
 * Same shape as getTakeoff(), but with the takeoff's raw PDF storage path
 * instead of a resolved signed URL -- for the marked-up-plan export route,
 * which reads the source file itself server-side.
 *
 * Known limitation from Drawings Part 1 Step 4: a drawing can now hold
 * several files, but this (and the export route built on it, from Phase
 * 2) only exports the FIRST one -- extending the marked-up-plan export to
 * cover every file is out of this pass's scope. pdfFilePath falls back to
 * Takeoff.pdfFileUrl itself if, somehow, the backfilled TakeoffFile row is
 * missing.
 */
export async function getTakeoffForExport(id: string): Promise<TakeoffExportDetail | null> {
  const row = await db.takeoff.findFirst({
    where: { id, organisationId: ORG_ID, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { measurements: { orderBy: { createdAt: "asc" } } } },
      files: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });
  if (!row) return null;

  const items = row.items.map(summariseItem);
  return {
    id: row.id,
    name: row.name,
    pdfFilePath: row.files[0]?.fileUrl ?? row.pdfFileUrl,
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

/** Also creates the drawing's first TakeoffFile -- every takeoff from now on has at least one row there from the moment it's created, same as every pre-Step-4 takeoff got via this migration's backfill. */
export async function createTakeoff(data: TakeoffCreateInput): Promise<{ id: string }> {
  const { pointsPerMetre, scaleRatioLabel } = resolvePointsPerMetre(data.scale);
  const takeoff = await db.takeoff.create({
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
  await db.takeoffFile.create({
    data: { organisationId: ORG_ID, takeoffId: takeoff.id, name: "Plan", fileUrl: data.pdfFileUrl, pageCount: data.pageCount ?? null, sortOrder: 0 },
  });
  return takeoff;
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
    data: {
      takeoffId, name: data.name, colour: data.colour, kind: data.kind, pricePerMetre: data.pricePerMetre, sortOrder: data.sortOrder,
      overrideJointWidthMm: data.overrideJointWidthMm ?? null,
      overrideJointDepthMm: data.overrideJointDepthMm ?? null,
      overrideWastePercent: data.overrideWastePercent ?? null,
    },
    select: { id: true },
  });
}

export async function updateTakeoffItem(id: string, data: TakeoffItemInput): Promise<void> {
  await db.takeoffItem.update({
    where: { id },
    data: {
      name: data.name, colour: data.colour, kind: data.kind, pricePerMetre: data.pricePerMetre, sortOrder: data.sortOrder,
      overrideJointWidthMm: data.overrideJointWidthMm ?? null,
      overrideJointDepthMm: data.overrideJointDepthMm ?? null,
      overrideWastePercent: data.overrideWastePercent ?? null,
    },
  });
}

/** Hard delete -- items/measurements aren't independently meaningful records (see the schema comment on TakeoffItem), cascades its measurements. */
export async function deleteTakeoffItem(id: string): Promise<void> {
  await db.takeoffItem.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Files (Drawings Part 1 Step 4) -- several PDFs per drawing, shown as tabs
// ---------------------------------------------------------------------------

/**
 * The raw storage path for ONE file on a drawing -- for the viewer's file-
 * streaming route. Org-scoped and 404-safe: returns null if the takeoff
 * doesn't exist (or is soft-deleted), or if fileId was given but doesn't
 * belong to this takeoff. Omitting fileId (or passing one that turns out
 * not to match) falls back to the takeoff's first file -- the same
 * null-means-first-file safety net as TakeoffMeasurement.takeoffFileId.
 */
export async function getTakeoffFileRawPath(takeoffId: string, fileId?: string | null): Promise<string | null> {
  const takeoff = await db.takeoff.findFirst({
    where: { id: takeoffId, organisationId: ORG_ID, deletedAt: null },
    select: { pdfFileUrl: true, files: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, fileUrl: true } } },
  });
  if (!takeoff) return null;
  const file = (fileId ? takeoff.files.find((f) => f.id === fileId) : null) ?? takeoff.files[0];
  return file?.fileUrl ?? takeoff.pdfFileUrl;
}

export async function listTakeoffFiles(takeoffId: string): Promise<TakeoffFileItem[]> {
  const rows = await db.takeoffFile.findMany({ where: { takeoffId, deletedAt: null }, orderBy: { sortOrder: "asc" } });
  return rows.map(summariseFile);
}

/** "Add file" -- appends a new tab at the end. Does not touch the takeoff's own scale; a per-file override is set separately if needed. */
export async function createTakeoffFile(takeoffId: string, data: { name: string; fileUrl: string; pageCount?: number }): Promise<{ id: string }> {
  const takeoff = await db.takeoff.findUniqueOrThrow({ where: { id: takeoffId }, select: { organisationId: true } });
  const maxSort = await db.takeoffFile.aggregate({ where: { takeoffId }, _max: { sortOrder: true } });
  return db.takeoffFile.create({
    data: {
      organisationId: takeoff.organisationId,
      takeoffId,
      name: data.name,
      fileUrl: data.fileUrl,
      pageCount: data.pageCount ?? null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
}

export async function renameTakeoffFile(id: string, name: string): Promise<void> {
  await db.takeoffFile.update({ where: { id }, data: { name } });
}

/** Simple up/down reordering of the file tabs -- same convention as the rate card's moveRateCardItem. */
export async function moveTakeoffFile(takeoffId: string, id: string, direction: "up" | "down"): Promise<void> {
  const files = await listTakeoffFiles(takeoffId);
  const index = files.findIndex((f) => f.id === id);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= files.length) return;

  await db.$transaction([
    db.takeoffFile.update({ where: { id: files[index].id }, data: { sortOrder: files[swapIndex].sortOrder } }),
    db.takeoffFile.update({ where: { id: files[swapIndex].id }, data: { sortOrder: files[index].sortOrder } }),
  ]);
}

/** For the removal confirm dialog -- "this file has N measurements" -- counts non-deleted measurements whose pageNumber belongs to this file. */
export async function countMeasurementsOnFile(takeoffId: string, fileId: string): Promise<number> {
  return db.takeoffMeasurement.count({ where: { takeoffItem: { takeoffId }, takeoffFileId: fileId } });
}

/** Soft delete -- reversible, same convention as Takeoff/Certification. Measurements that belonged to this file are left in place (not cascaded), consistent with how removing a file is a confirm-guarded but recoverable action, not a hard delete. */
export async function softDeleteTakeoffFile(id: string): Promise<void> {
  await db.takeoffFile.update({ where: { id }, data: { deletedAt: new Date() } });
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
      takeoffFileId: data.takeoffFileId ?? null,
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

  // A COUNT item becomes a quantity-N, unit "each" line; LENGTH stays
  // quantity-metres, unit "m" -- reusing the existing quote builder as-is,
  // no new quoting engine (per the Drawings Part 2 brief).
  const lineItems = takeoff.items
    .filter((i) => (i.kind === "COUNT" ? i.count > 0 : i.totalMetres > 0))
    .map((i) =>
      i.kind === "COUNT"
        ? { description: i.name, quantity: i.count, unit: "each", unitPrice: Number(i.pricePerMetre) }
        : { description: i.name, quantity: i.totalMetres, unit: "m", unitPrice: Number(i.pricePerMetre) }
    );

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
