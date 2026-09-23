import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { resolveFinancePeriod, type FinancePeriod, type FinancePeriodPreset } from "@/services/finance.service";
import type { ProductInput } from "@/validators/product";

// Explicit hand-written return types throughout -- see the Prisma typing
// note in customer.service.ts.

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export type ProductListItem = {
  id: string;
  manufacturer: string;
  name: string;
  colour: string;
  finish: string | null;
  attributes: string[];
  supplier: string | null;
  sku: string | null;
  unitCost: unknown;
  stockQuantity: number;
  stockUnit: string;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  isNegativeStock: boolean;
};

export type ProductFilters = {
  query?: string;
  manufacturer?: string;
  colour?: string;
  attribute?: string;
  supplier?: string;
  lowStockOnly?: boolean;
};

function toListItem(p: {
  id: string; manufacturer: string; name: string; colour: string; finish: string | null;
  attributes: string[]; supplier: string | null; sku: string | null; unitCost: unknown;
  stockQuantity: unknown; stockUnit: string; lowStockThreshold: unknown;
}): ProductListItem {
  const stockQuantity = Number(p.stockQuantity);
  const lowStockThreshold = p.lowStockThreshold != null ? Number(p.lowStockThreshold) : null;
  return {
    id: p.id, manufacturer: p.manufacturer, name: p.name, colour: p.colour, finish: p.finish,
    attributes: p.attributes, supplier: p.supplier, sku: p.sku, unitCost: p.unitCost,
    stockQuantity, stockUnit: p.stockUnit, lowStockThreshold,
    isLowStock: lowStockThreshold != null && stockQuantity <= lowStockThreshold,
    isNegativeStock: stockQuantity < 0,
  };
}

export async function listProducts(filters: ProductFilters = {}): Promise<ProductListItem[]> {
  const { query, manufacturer, colour, attribute, supplier, lowStockOnly } = filters;
  const trimmedQ = query?.trim();

  const rows = await db.product.findMany({
    where: {
      organisationId: ORG_ID,
      deletedAt: null,
      ...(manufacturer ? { manufacturer } : {}),
      ...(colour ? { colour } : {}),
      ...(supplier ? { supplier } : {}),
      ...(attribute ? { attributes: { has: attribute } } : {}),
      ...(trimmedQ
        ? {
            OR: [
              { manufacturer: { contains: trimmedQ, mode: "insensitive" } },
              { name: { contains: trimmedQ, mode: "insensitive" } },
              { colour: { contains: trimmedQ, mode: "insensitive" } },
              { sku: { contains: trimmedQ, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ manufacturer: "asc" }, { name: "asc" }, { colour: "asc" }],
  });

  const items = rows.map(toListItem);
  // Low-stock is a computed comparison (stockQuantity vs. lowStockThreshold,
  // two columns on the same row) -- Prisma can't express that in `where`, so
  // it's filtered here rather than in the query. The products table is
  // small, so this is cheap.
  return lowStockOnly ? items.filter((i) => i.isLowStock) : items;
}

export type ProductFilterOptions = { manufacturers: string[]; colours: string[]; suppliers: string[] };

export async function listProductFilterOptions(): Promise<ProductFilterOptions> {
  const rows = await db.product.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    select: { manufacturer: true, colour: true, supplier: true },
  });
  return {
    manufacturers: Array.from(new Set(rows.map((r) => r.manufacturer))).sort(),
    colours: Array.from(new Set(rows.map((r) => r.colour))).sort(),
    suppliers: Array.from(new Set(rows.map((r) => r.supplier).filter((s): s is string => Boolean(s)))).sort(),
  };
}

export type ProductDetail = {
  id: string;
  manufacturer: string;
  name: string;
  colour: string;
  finish: string | null;
  attributes: string[];
  supplier: string | null;
  sku: string | null;
  unitCost: unknown;
  stockQuantity: number;
  stockUnit: string;
  lowStockThreshold: number | null;
};

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const row = await db.product.findFirst({ where: { id, organisationId: ORG_ID, deletedAt: null } });
  if (!row) return null;
  return {
    id: row.id, manufacturer: row.manufacturer, name: row.name, colour: row.colour, finish: row.finish,
    attributes: row.attributes, supplier: row.supplier, sku: row.sku, unitCost: row.unitCost,
    stockQuantity: Number(row.stockQuantity), stockUnit: row.stockUnit,
    lowStockThreshold: row.lowStockThreshold != null ? Number(row.lowStockThreshold) : null,
  };
}

export async function createProduct(data: ProductInput) {
  return db.product.create({
    data: {
      organisationId: ORG_ID,
      manufacturer: data.manufacturer,
      name: data.name,
      colour: data.colour,
      finish: data.finish || null,
      attributes: data.attributes,
      supplier: data.supplier || null,
      sku: data.sku || null,
      unitCost: data.unitCost ?? null,
      stockQuantity: data.stockQuantity,
      stockUnit: data.stockUnit,
      lowStockThreshold: data.lowStockThreshold ?? null,
    },
  });
}

/** Catalogue-field edits only -- stock is changed exclusively through addStock/setStock below, never through this form, so a save here can never accidentally wipe a stock level someone else just adjusted. */
export async function updateProduct(id: string, data: ProductInput) {
  return db.product.update({
    where: { id },
    data: {
      manufacturer: data.manufacturer,
      name: data.name,
      colour: data.colour,
      finish: data.finish || null,
      attributes: data.attributes,
      supplier: data.supplier || null,
      sku: data.sku || null,
      unitCost: data.unitCost ?? null,
      lowStockThreshold: data.lowStockThreshold ?? null,
    },
  });
}

/**
 * Soft-delete -- mirrors Customer/Job/Certification. Admin-only, confirmed;
 * enforced with requireAdmin() in the delete action, not here. Never
 * cascades: historical MaterialUsage/PropertyWorkLog rows keep their
 * product reference.
 */
export async function softDeleteProduct(id: string, userId: string | null): Promise<void> {
  await db.product.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } });
}

export async function restoreProduct(id: string): Promise<void> {
  await db.product.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
}

// ---------------------------------------------------------------------------
// Stock adjustment
// ---------------------------------------------------------------------------

/** "+ add stock" -- a delivery arriving. quantity must be positive (validated by stockAdjustSchema at the action layer). */
export async function addStock(productId: string, quantity: number) {
  return db.product.update({ where: { id: productId }, data: { stockQuantity: { increment: quantity } } });
}

/** Manual "set stock to X" -- e.g. reconciling after a physical count. */
export async function setStock(productId: string, quantity: number) {
  return db.product.update({ where: { id: productId }, data: { stockQuantity: quantity } });
}

/**
 * The optional auto-decrement seam -- called once from finishJob() in
 * completion.service.ts, right after its MaterialUsage rows are created.
 * Deliberately NOT clamped at 0: an over-use should be visible as a flagged
 * negative stock (see ProductListItem.isNegativeStock) rather than silently
 * floored, which would hide a real stock-count problem. Never throws -- a
 * stock-tracking failure must never block a job completing; the caller
 * wraps this in try/catch per product as an extra belt-and-braces measure.
 */
export async function decrementStockForUsage(productId: string, quantityUsed: number): Promise<void> {
  await db.product.update({ where: { id: productId }, data: { stockQuantity: { decrement: quantityUsed } } });
}

export type LowStockItem = { id: string; manufacturer: string; name: string; colour: string; stockQuantity: number; stockUnit: string; lowStockThreshold: number };
export type LowStockSummary = { count: number; items: LowStockItem[] };

export async function getLowStockSummary(): Promise<LowStockSummary> {
  const rows = await db.product.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, lowStockThreshold: { not: null } },
    select: { id: true, manufacturer: true, name: true, colour: true, stockQuantity: true, stockUnit: true, lowStockThreshold: true },
  });

  const items: LowStockItem[] = rows
    .filter((r) => Number(r.stockQuantity) <= Number(r.lowStockThreshold))
    .map((r) => ({
      id: r.id, manufacturer: r.manufacturer, name: r.name, colour: r.colour,
      stockQuantity: Number(r.stockQuantity), stockUnit: r.stockUnit, lowStockThreshold: Number(r.lowStockThreshold),
    }))
    .sort((a, b) => a.stockQuantity - b.stockQuantity);

  return { count: items.length, items };
}

// ---------------------------------------------------------------------------
// Usage report + total spend
// ---------------------------------------------------------------------------

export { resolveFinancePeriod, type FinancePeriod, type FinancePeriodPreset };

export type UsageJobEntry = {
  usageId: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  visitDate: Date;
  quantityUsed: number;
  unit: string;
};

export type ProductUsageRow = {
  productId: string;
  manufacturer: string;
  name: string;
  colour: string;
  totalQuantity: number;
  unit: string;
  totalCost: number;
  /** Nested, not a separate query -- see getUsageSummary's comment on why this avoids N+1 for the "link back to jobs" drill-down. */
  entries: UsageJobEntry[];
};

export type MaterialsUsageSummary = {
  period: FinancePeriod;
  totalSpend: number;
  byProduct: ProductUsageRow[];
};

/**
 * Cost basis: uses the cost recorded on each MaterialUsage entry where
 * present, otherwise estimates quantityUsed x the product's CURRENT unit
 * cost. This deliberately differs from getMaterialsCostSummary in
 * finance.service.ts, which only ever counts a recorded cost and treats a
 * missing one as £0 -- that function feeds the Finance area's stricter
 * cost-of-goods ledger, where an estimate would be misleading. This report
 * is the fuller "what materials actually cost us" view the owner asked for,
 * so an unrecorded historical cost is estimated rather than silently
 * treated as free. Soft-deleted products are excluded (their historical
 * usage still exists and is still counted -- only the catalogue listing
 * hides them).
 *
 * One query for the whole period, with each usage row's job/product already
 * included -- the per-product job drill-down (byProduct[].entries) is built
 * from the SAME rows in memory rather than a second query per product, so
 * this stays "a few targeted queries" regardless of how many distinct
 * products were used.
 */
export async function getUsageSummary(period: FinancePeriod): Promise<MaterialsUsageSummary> {
  const usages = await db.materialUsage.findMany({
    where: {
      job: { organisationId: ORG_ID, deletedAt: null, createdAt: { gte: period.from, lt: period.to } },
      product: { deletedAt: null },
    },
    select: {
      id: true, quantityUsed: true, unit: true, cost: true,
      product: { select: { id: true, manufacturer: true, name: true, colour: true, unitCost: true } },
      job: { select: { id: true, jobNumber: true, createdAt: true, customer: { select: { name: true } } } },
    },
    orderBy: { job: { createdAt: "desc" } },
  });

  const byProduct = new Map<string, ProductUsageRow>();
  let totalSpend = 0;

  for (const u of usages) {
    const qty = Number(u.quantityUsed);
    const cost = u.cost != null ? Number(u.cost) : qty * Number(u.product.unitCost ?? 0);
    totalSpend += cost;

    const entry = byProduct.get(u.product.id) ?? {
      productId: u.product.id, manufacturer: u.product.manufacturer, name: u.product.name, colour: u.product.colour,
      totalQuantity: 0, unit: u.unit, totalCost: 0, entries: [] as UsageJobEntry[],
    };
    entry.totalQuantity += qty;
    entry.totalCost += cost;
    entry.entries.push({
      usageId: u.id, jobId: u.job.id, jobNumber: u.job.jobNumber, customerName: u.job.customer.name,
      visitDate: u.job.createdAt, quantityUsed: qty, unit: u.unit,
    });
    byProduct.set(u.product.id, entry);
  }

  return {
    period,
    totalSpend: +totalSpend.toFixed(2),
    byProduct: Array.from(byProduct.values())
      .map((v) => ({ ...v, totalQuantity: +v.totalQuantity.toFixed(2), totalCost: +v.totalCost.toFixed(2) }))
      .sort((a, b) => b.totalCost - a.totalCost),
  };
}
