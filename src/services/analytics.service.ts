import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { enquiryStages } from "@/validators/enquiry";

// Most of these functions pull the relevant rows and aggregate in JS rather
// than leaning on Prisma's groupBy — several need to group by a *related*
// model's field (e.g. MaterialUsage -> Product.colour), which groupBy can't
// do in one query, and at this business's scale (hundreds, not millions, of
// rows) an in-memory reduce is simpler and plenty fast. Every function still
// scopes its query to ORG_ID and has an explicit return type — see the
// Prisma typing note in customer.service.ts.

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function monthKeysFrom(start: Date, months: number): string[] {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  for (let i = 0; i < months; i++) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function startOfMonthsAgo(n: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - n, 1);
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

export type MonthlyRevenue = { month: string; revenue: number };

/**
 * Revenue = sum of paid Invoice.amount, bucketed by the month it was paid.
 * Falls back to completed Job.price (bucketed by completion date) for jobs
 * that don't yet have an invoice at all — covers any legacy completed jobs
 * from before Milestone 6 rather than silently under-reporting revenue.
 */
export async function revenueByMonth(months = 12): Promise<MonthlyRevenue[]> {
  const start = startOfMonthsAgo(months - 1);
  const monthKeys = monthKeysFrom(start, months);

  const [invoices, jobsWithoutInvoice] = await Promise.all([
    db.invoice.findMany({
      where: { paidAt: { gte: start }, customer: { organisationId: ORG_ID }, deletedAt: null },
      select: { paidAt: true, amount: true },
    }),
    db.job.findMany({
      where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED", actualEnd: { gte: start }, invoice: null },
      select: { actualEnd: true, price: true },
    }),
  ]);

  const buckets = new Map(monthKeys.map((m) => [m, 0]));
  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const key = monthKey(inv.paidAt);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + Number(inv.amount));
  }
  for (const job of jobsWithoutInvoice) {
    if (!job.actualEnd) continue;
    const key = monthKey(job.actualEnd);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + Number(job.price));
  }

  return monthKeys.map((key) => ({ month: monthLabel(key), revenue: +buckets.get(key)!.toFixed(2) }));
}

// ---------------------------------------------------------------------------
// Jobs volume
// ---------------------------------------------------------------------------

export type MonthlyJobs = { month: string; count: number };

export async function jobsByMonth(months = 12): Promise<MonthlyJobs[]> {
  const start = startOfMonthsAgo(months - 1);
  const monthKeys = monthKeysFrom(start, months);

  const jobs = await db.job.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const buckets = new Map(monthKeys.map((m) => [m, 0]));
  for (const job of jobs) {
    const key = monthKey(job.createdAt);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
  }

  return monthKeys.map((key) => ({ month: monthLabel(key), count: buckets.get(key)! }));
}

// ---------------------------------------------------------------------------
// Lead conversion funnel
// ---------------------------------------------------------------------------

export type FunnelStage = { stage: string; count: number };
export type LeadConversion = { funnel: FunnelStage[]; totalEnquiries: number; convertedCount: number; conversionPct: number };

export async function leadConversion(): Promise<LeadConversion> {
  const grouped = await db.enquiry.groupBy({
    by: ["stage"],
    where: { organisationId: ORG_ID },
    _count: { _all: true },
  });

  const totalEnquiries = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const convertedCount = grouped
    .filter((g) => g.stage === "BOOKED" || g.stage === "COMPLETED")
    .reduce((sum, g) => sum + g._count._all, 0);

  const funnel = enquiryStages.map((stage) => ({
    stage,
    count: grouped.find((g) => g.stage === stage)?._count._all ?? 0,
  }));

  return {
    funnel,
    totalEnquiries,
    convertedCount,
    conversionPct: totalEnquiries > 0 ? Math.round((convertedCount / totalEnquiries) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Materials — top colours / top products
// ---------------------------------------------------------------------------

export type ColourUsage = { colour: string; count: number; pct: number };

export async function topColours(limit = 8): Promise<ColourUsage[]> {
  const usages = await db.materialUsage.findMany({
    where: { job: { organisationId: ORG_ID } },
    select: { product: { select: { colour: true } } },
  });

  const counts = new Map<string, number>();
  for (const u of usages) counts.set(u.product.colour, (counts.get(u.product.colour) ?? 0) + 1);

  const total = usages.length;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([colour, count]) => ({ colour, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }));
}

export type ProductUsage = { product: string; count: number };

export async function topProducts(limit = 8): Promise<ProductUsage[]> {
  const usages = await db.materialUsage.findMany({
    where: { job: { organisationId: ORG_ID } },
    select: { product: { select: { manufacturer: true, name: true } } },
  });

  const counts = new Map<string, number>();
  for (const u of usages) {
    const label = `${u.product.manufacturer} ${u.product.name}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([product, count]) => ({ product, count }));
}

// ---------------------------------------------------------------------------
// Profitability by service/work type — proxied by MaterialUsage.applicationArea
// (Job has no dedicated "work type" field of its own).
// ---------------------------------------------------------------------------

export type ServiceProfitability = {
  serviceType: string;
  jobCount: number;
  avgPrice: number;
  avgMaterialCost: number;
  estMarginPct: number | null;
};

export async function mostProfitableServices(): Promise<ServiceProfitability[]> {
  const jobs = await db.job.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED" },
    select: { price: true, materials: { take: 1, select: { applicationArea: true, cost: true } } },
  });

  const byArea = new Map<string, { jobCount: number; priceSum: number; costSum: number; costCount: number }>();
  for (const job of jobs) {
    const area = job.materials[0]?.applicationArea ?? "OTHER";
    const entry = byArea.get(area) ?? { jobCount: 0, priceSum: 0, costSum: 0, costCount: 0 };
    entry.jobCount += 1;
    entry.priceSum += Number(job.price);
    if (job.materials[0]?.cost != null) {
      entry.costSum += Number(job.materials[0].cost);
      entry.costCount += 1;
    }
    byArea.set(area, entry);
  }

  return Array.from(byArea.entries())
    .map(([serviceType, e]) => {
      const avgPrice = e.jobCount > 0 ? e.priceSum / e.jobCount : 0;
      const avgMaterialCost = e.costCount > 0 ? e.costSum / e.costCount : 0;
      const estMarginPct = e.costCount > 0 && avgPrice > 0 ? Math.round(((avgPrice - avgMaterialCost) / avgPrice) * 100) : null;
      return {
        serviceType,
        jobCount: e.jobCount,
        avgPrice: +avgPrice.toFixed(2),
        avgMaterialCost: +avgMaterialCost.toFixed(2),
        estMarginPct,
      };
    })
    .sort((a, b) => b.avgPrice - a.avgPrice);
}

// ---------------------------------------------------------------------------
// Repeat vs new revenue
// ---------------------------------------------------------------------------

export type MonthlyRepeatRevenue = { month: string; newRevenue: number; repeatRevenue: number };

/**
 * Classifies a customer's *first ever* completed job (chronologically, across
 * all time) as "new" revenue and every job after that as "repeat" revenue,
 * then buckets by month within the requested window.
 */
export async function repeatRevenueByMonth(months = 12): Promise<MonthlyRepeatRevenue[]> {
  const start = startOfMonthsAgo(months - 1);
  const monthKeys = monthKeysFrom(start, months);

  const allCompleted = await db.job.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED" },
    select: { customerId: true, price: true, actualEnd: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map(monthKeys.map((m) => [m, { newRevenue: 0, repeatRevenue: 0 }]));
  const seenCustomers = new Set<string>();

  for (const job of allCompleted) {
    const isRepeat = seenCustomers.has(job.customerId);
    seenCustomers.add(job.customerId);

    const date = job.actualEnd ?? job.createdAt;
    const bucket = buckets.get(monthKey(date));
    if (!bucket) continue; // outside the requested window

    if (isRepeat) bucket.repeatRevenue += Number(job.price);
    else bucket.newRevenue += Number(job.price);
  }

  return monthKeys.map((key) => {
    const b = buckets.get(key)!;
    return { month: monthLabel(key), newRevenue: +b.newRevenue.toFixed(2), repeatRevenue: +b.repeatRevenue.toFixed(2) };
  });
}

export async function repeatCustomerPct(): Promise<number> {
  const jobs = await db.job.findMany({ where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED" }, select: { customerId: true } });
  const counts = new Map<string, number>();
  for (const j of jobs) counts.set(j.customerId, (counts.get(j.customerId) ?? 0) + 1);

  const withJobs = counts.size;
  const repeat = Array.from(counts.values()).filter((c) => c > 1).length;
  return withJobs > 0 ? Math.round((repeat / withJobs) * 100) : 0;
}

// ---------------------------------------------------------------------------
// Simple scalar aggregates
// ---------------------------------------------------------------------------

export async function avgJobValue(): Promise<number> {
  const result = await db.job.aggregate({ where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED" }, _avg: { price: true } });
  return Number(result._avg.price ?? 0);
}

export type TechnicianPerformance = { technicianId: string; name: string; jobsCompleted: number; avgSatisfaction: number | null };

export async function technicianPerformance(): Promise<TechnicianPerformance[]> {
  const jobs = await db.job.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED", technicianId: { not: null } },
    select: { technicianId: true, technician: { select: { name: true } }, satisfactionRating: true },
  });

  const byTech = new Map<string, { name: string; jobsCompleted: number; ratingSum: number; ratingCount: number }>();
  for (const j of jobs) {
    if (!j.technicianId) continue;
    const entry = byTech.get(j.technicianId) ?? { name: j.technician?.name ?? "Unknown", jobsCompleted: 0, ratingSum: 0, ratingCount: 0 };
    entry.jobsCompleted += 1;
    if (j.satisfactionRating != null) {
      entry.ratingSum += j.satisfactionRating;
      entry.ratingCount += 1;
    }
    byTech.set(j.technicianId, entry);
  }

  return Array.from(byTech.entries())
    .map(([technicianId, e]) => ({
      technicianId,
      name: e.name,
      jobsCompleted: e.jobsCompleted,
      avgSatisfaction: e.ratingCount > 0 ? +(e.ratingSum / e.ratingCount).toFixed(1) : null,
    }))
    .sort((a, b) => b.jobsCompleted - a.jobsCompleted);
}
