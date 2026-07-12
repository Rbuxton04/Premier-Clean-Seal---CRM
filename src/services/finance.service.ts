import type { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID, getOrgSettings } from "@/lib/settings";
import { revenueByMonth, type MonthlyRevenue } from "@/services/analytics.service";

// Read-only finance reporting/export layer for the Finance area + the
// ACCOUNTANT role. Every query is org-scoped (Invoice has no organisationId
// of its own, so it's scoped through the customer relation, same as
// invoice.service.ts) and excludes deletedAt (voided/soft-deleted) records
// from totals — the invoices ledger is the one exception, since voided
// invoices must stay visible there (clearly marked), just never counted
// toward revenue. Explicit hand-written return types throughout — see the
// Prisma typing note in customer.service.ts.

const OUTSTANDING_STATUSES: PaymentStatus[] = ["UNPAID", "DEPOSIT_PAID", "PARTIALLY_PAID", "OVERDUE"];

export type FinancePeriodPreset = "month" | "quarter" | "year" | "custom";
export type FinancePeriod = { preset: FinancePeriodPreset; from: Date; to: Date; label: string };

/** to is always exclusive (the day/month/year after the period ends), so every range filter below can use a plain `lt`. */
export function resolveFinancePeriod(preset: FinancePeriodPreset, customFrom?: string, customTo?: string): FinancePeriod {
  const now = new Date();

  if (preset === "quarter") {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), qStartMonth, 1);
    const to = new Date(now.getFullYear(), qStartMonth + 3, 1);
    return { preset, from, to, label: `Q${qStartMonth / 3 + 1} ${now.getFullYear()}` };
  }
  if (preset === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear() + 1, 0, 1);
    return { preset, from, to, label: String(now.getFullYear()) };
  }
  if (preset === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    const toDate = new Date(customTo);
    const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1);
    return { preset, from, to, label: `${customFrom} to ${customTo}` };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { preset: "month", from, to, label: from.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
}

export type VatSummary = {
  registered: boolean;
  ratePercent: number;
  netInPeriod: number;
  vatInPeriod: number;
  grossInPeriod: number;
};

export type FinanceOverview = {
  period: FinancePeriod;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueAmount: number;
  avgJobValue: number;
  depositsHeld: number;
  revenueByMonth: MonthlyRevenue[];
  vat: VatSummary;
};

export async function getFinanceOverview(period: FinancePeriod): Promise<FinanceOverview> {
  const now = new Date();
  const [org, periodAgg, paidAgg, outstandingAgg, overdueAgg, avgJobAgg, depositsAgg, revenue] = await Promise.all([
    getOrgSettings(),
    db.invoice.aggregate({
      _sum: { subtotal: true, vatAmount: true, amount: true },
      where: { deletedAt: null, customer: { organisationId: ORG_ID }, createdAt: { gte: period.from, lt: period.to } },
    }),
    db.invoice.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, customer: { organisationId: ORG_ID }, paidAt: { gte: period.from, lt: period.to } },
    }),
    db.invoice.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, customer: { organisationId: ORG_ID }, status: { in: OUTSTANDING_STATUSES } },
    }),
    db.invoice.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        customer: { organisationId: ORG_ID },
        OR: [{ status: "OVERDUE" }, { status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { lt: now } }],
      },
    }),
    db.job.aggregate({
      _avg: { price: true },
      where: { organisationId: ORG_ID, deletedAt: null, status: "COMPLETED", actualEnd: { gte: period.from, lt: period.to } },
    }),
    db.job.aggregate({
      _sum: { depositPaid: true },
      where: { organisationId: ORG_ID, deletedAt: null, paymentStatus: "DEPOSIT_PAID" },
    }),
    revenueByMonth(6),
  ]);

  return {
    period,
    totalInvoiced: Number(periodAgg._sum.amount ?? 0),
    totalPaid: Number(paidAgg._sum.amount ?? 0),
    // Outstanding/overdue are current-position figures (as of now), not
    // bounded by the selected reporting period -- an invoice raised months
    // ago and still unpaid is still outstanding today.
    totalOutstanding: Number(outstandingAgg._sum.amount ?? 0),
    overdueAmount: Number(overdueAgg._sum.amount ?? 0),
    avgJobValue: Number(avgJobAgg._avg.price ?? 0),
    depositsHeld: Number(depositsAgg._sum.depositPaid ?? 0),
    revenueByMonth: revenue,
    vat: {
      registered: org.vatRegistered,
      ratePercent: Number(org.vatRatePercent),
      netInPeriod: Number(periodAgg._sum.subtotal ?? 0),
      vatInPeriod: Number(periodAgg._sum.vatAmount ?? 0),
      grossInPeriod: Number(periodAgg._sum.amount ?? 0),
    },
  };
}

export type FinanceInvoiceFilter = { status?: PaymentStatus; customerId?: string; from?: Date; to?: Date };

export type FinanceInvoiceRow = {
  id: string;
  invoiceNumber: string;
  createdAt: Date;
  dueDate: Date;
  subtotal: unknown;
  vatAmount: unknown;
  amount: unknown;
  status: string;
  paidAt: Date | null;
  deletedAt: Date | null;
  customer: { id: string; name: string };
  job: { id: string; jobNumber: string } | null;
};

/**
 * The Finance ledger deliberately does NOT filter out voided invoices (the
 * operational /invoices page does) -- invoices are retained records, so a
 * voided one must stay visible here, just clearly marked (row.deletedAt) and
 * excluded from every revenue total above and from the CSV/summary maths.
 */
export async function listFinanceInvoices(filter: FinanceInvoiceFilter): Promise<FinanceInvoiceRow[]> {
  const rows = await db.invoice.findMany({
    where: {
      customer: { organisationId: ORG_ID },
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.from || filter.to
        ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } }
        : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      job: { select: { id: true, jobNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows as FinanceInvoiceRow[];
}

export type OutstandingInvoiceRow = {
  id: string;
  invoiceNumber: string;
  dueDate: Date;
  amount: unknown;
  status: string;
  overdue: boolean;
  customer: { id: string; name: string };
  job: { id: string; jobNumber: string } | null;
};

export type OutstandingJobRow = {
  id: string;
  jobNumber: string;
  price: unknown;
  depositPaid: unknown;
  balanceDue: unknown;
  paymentStatus: string;
  customer: { id: string; name: string };
};

export type OutstandingSummary = {
  invoices: OutstandingInvoiceRow[];
  totalOutstanding: number;
  jobsWithBalance: OutstandingJobRow[];
  totalBalanceDue: number;
  depositsHeld: number;
};

export async function getOutstanding(): Promise<OutstandingSummary> {
  const now = new Date();
  const [invoices, jobs, depositsAgg] = await Promise.all([
    db.invoice.findMany({
      where: { deletedAt: null, customer: { organisationId: ORG_ID }, status: { in: OUTSTANDING_STATUSES } },
      include: { customer: { select: { id: true, name: true } }, job: { select: { id: true, jobNumber: true } } },
      orderBy: { dueDate: "asc" },
    }),
    db.job.findMany({
      where: { organisationId: ORG_ID, deletedAt: null, balanceDue: { gt: 0 } },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.job.aggregate({
      _sum: { depositPaid: true },
      where: { organisationId: ORG_ID, deletedAt: null, paymentStatus: "DEPOSIT_PAID" },
    }),
  ]);

  const invoiceRows: OutstandingInvoiceRow[] = invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    dueDate: i.dueDate,
    amount: i.amount,
    status: i.status,
    overdue: i.status === "OVERDUE" || i.dueDate < now,
    customer: i.customer,
    job: i.job,
  }));

  return {
    invoices: invoiceRows,
    totalOutstanding: +invoices.reduce((sum, i) => sum + Number(i.amount), 0).toFixed(2),
    jobsWithBalance: jobs,
    totalBalanceDue: +jobs.reduce((sum, j) => sum + Number(j.balanceDue), 0).toFixed(2),
    depositsHeld: Number(depositsAgg._sum.depositPaid ?? 0),
  };
}

export type StatusValue = { status: string; count: number; total: number };
export type QuoteValueSummary = { period: FinancePeriod; byStatus: StatusValue[]; totalValue: number; totalCount: number };
export type JobValueSummary = { period: FinancePeriod; byStatus: StatusValue[]; totalValue: number; totalCount: number };

function groupByStatus(rows: Array<{ status: string; value: number }>): StatusValue[] {
  const byStatus = new Map<string, { count: number; total: number }>();
  rows.forEach((r) => {
    const entry = byStatus.get(r.status) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += r.value;
    byStatus.set(r.status, entry);
  });
  return Array.from(byStatus.entries()).map(([status, v]) => ({ status, count: v.count, total: +v.total.toFixed(2) }));
}

export async function getQuoteValueSummary(period: FinancePeriod): Promise<QuoteValueSummary> {
  const quotes = await db.quote.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, createdAt: { gte: period.from, lt: period.to } },
    select: { status: true, total: true },
  });
  const rows = quotes.map((q) => ({ status: q.status, value: Number(q.total) }));
  return {
    period,
    byStatus: groupByStatus(rows),
    totalValue: +rows.reduce((sum, r) => sum + r.value, 0).toFixed(2),
    totalCount: rows.length,
  };
}

export async function getJobValueSummary(period: FinancePeriod): Promise<JobValueSummary> {
  const jobs = await db.job.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, createdAt: { gte: period.from, lt: period.to } },
    select: { status: true, price: true },
  });
  const rows = jobs.map((j) => ({ status: j.status, value: Number(j.price) }));
  return {
    period,
    byStatus: groupByStatus(rows),
    totalValue: +rows.reduce((sum, r) => sum + r.value, 0).toFixed(2),
    totalCount: rows.length,
  };
}

export type MaterialsCostByProduct = { productId: string; productName: string; totalCost: number; totalQuantity: number };
export type MaterialsCostSummary = { period: FinancePeriod; totalCost: number; byProduct: MaterialsCostByProduct[] };

/**
 * Deliberately broader than analytics.service.ts's topColours/topProducts
 * (which only count COMPLETED jobs): this is a real spend/cost report, and
 * money spent on materials for a since-cancelled or still-in-progress job is
 * still money spent, so it stays in the total. Only deletedAt-hidden jobs
 * are excluded, matching the rest of this file's finance-reporting rule.
 */
export async function getMaterialsCostSummary(period: FinancePeriod): Promise<MaterialsCostSummary> {
  const usages = await db.materialUsage.findMany({
    where: { job: { organisationId: ORG_ID, deletedAt: null, createdAt: { gte: period.from, lt: period.to } } },
    include: { product: { select: { id: true, manufacturer: true, name: true, colour: true } } },
  });

  const byProduct = new Map<string, { name: string; cost: number; qty: number }>();
  let totalCost = 0;
  usages.forEach((u) => {
    const cost = Number(u.cost ?? 0);
    totalCost += cost;
    const entry = byProduct.get(u.productId) ?? { name: `${u.product.manufacturer} ${u.product.name} (${u.product.colour})`, cost: 0, qty: 0 };
    entry.cost += cost;
    entry.qty += Number(u.quantityUsed);
    byProduct.set(u.productId, entry);
  });

  return {
    period,
    totalCost: +totalCost.toFixed(2),
    byProduct: Array.from(byProduct.entries())
      .map(([productId, v]) => ({ productId, productName: v.name, totalCost: +v.cost.toFixed(2), totalQuantity: +v.qty.toFixed(2) }))
      .sort((a, b) => b.totalCost - a.totalCost),
  };
}

// ---------------------------------------------------------------------------
// CSV export -- plain, dependency-free CSV generation (no PDF library needed
// here; the finance overview/ledger/outstanding data is inherently tabular).
// ---------------------------------------------------------------------------

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

export function buildInvoicesCsv(rows: FinanceInvoiceRow[]): string {
  const headers = ["Date", "Invoice No.", "Customer", "Job", "Net", "VAT", "Gross", "Status", "Paid date", "Voided"];
  const body = rows.map((r) => [
    r.createdAt.toLocaleDateString("en-GB"),
    r.invoiceNumber,
    r.customer.name,
    r.job?.jobNumber ?? "",
    Number(r.subtotal).toFixed(2),
    Number(r.vatAmount).toFixed(2),
    Number(r.amount).toFixed(2),
    r.status,
    r.paidAt ? r.paidAt.toLocaleDateString("en-GB") : "",
    r.deletedAt ? "Yes" : "No",
  ]);
  return toCsv(headers, body);
}

export function buildOutstandingCsv(summary: OutstandingSummary): string {
  const headers = ["Type", "Reference", "Customer", "Due date", "Amount", "Status"];
  const rows: Array<Array<string | number>> = [
    ...summary.invoices.map((i) => [
      "Invoice",
      i.invoiceNumber,
      i.customer.name,
      i.dueDate.toLocaleDateString("en-GB"),
      Number(i.amount).toFixed(2),
      i.overdue ? "Overdue" : i.status,
    ]),
    ...summary.jobsWithBalance.map((j) => ["Job balance", j.jobNumber, j.customer.name, "", Number(j.balanceDue).toFixed(2), j.paymentStatus]),
  ];
  return toCsv(headers, rows);
}

export function buildSummaryCsv(overview: FinanceOverview): string {
  const headers = ["Metric", "Value"];
  const rows: Array<[string, string]> = [
    ["Period", overview.period.label],
    ["Total invoiced", overview.totalInvoiced.toFixed(2)],
    ["Total paid", overview.totalPaid.toFixed(2)],
    ["Total outstanding", overview.totalOutstanding.toFixed(2)],
    ["Overdue amount", overview.overdueAmount.toFixed(2)],
    ["Average job value", overview.avgJobValue.toFixed(2)],
    ["Deposits held", overview.depositsHeld.toFixed(2)],
    ["VAT registered", overview.vat.registered ? "Yes" : "No"],
    ["VAT rate %", overview.vat.ratePercent.toFixed(2)],
    ["Net (period)", overview.vat.netInPeriod.toFixed(2)],
    ["VAT (period)", overview.vat.vatInPeriod.toFixed(2)],
    ["Gross (period)", overview.vat.grossInPeriod.toFixed(2)],
  ];
  return toCsv(headers, rows);
}
