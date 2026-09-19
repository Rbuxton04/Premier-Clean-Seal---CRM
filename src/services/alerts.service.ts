import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { formatGBP } from "@/lib/utils";
import { daysUntil } from "@/services/certification.service";

// Reusable server-side aggregation for the dashboard "Alerts & Updates" box.
// A handful of targeted queries (no N+1) -- certifications, overdue
// invoices, and two optional/secondary nudges -- folded into one flat,
// pre-sorted list so the dashboard page only has to render it.

export type AlertSeverity = "red" | "amber";
export type AlertCategory = "certification" | "invoice" | "quote" | "job";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  message: string;
  href: string;
  /** Signed days-from-now used to sort primary alerts most-urgent-first -- more negative (further overdue/expired) sorts earlier. Secondary nudges don't participate in this sort, see getAlerts(). */
  urgencyDays: number;
};

const STALE_QUOTE_DAYS = 7;

async function certificationAlerts(now: Date): Promise<AlertItem[]> {
  // "expiring soon or expired" only -- the 60-day "upcoming" tier is
  // certifications-page-only informational, not alert-worthy yet. 30 days
  // out is the widest net an alert needs to cast, so the query bound
  // matches EXPIRING_SOON_DAYS in certification.service.ts directly.
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + 30);

  const certs = await db.certification.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, expiryDate: { lte: cutoff } },
    select: { id: true, name: true, expiryDate: true, ownerType: true, user: { select: { name: true } } },
    orderBy: { expiryDate: "asc" },
  });

  return certs.map((c) => {
    const days = daysUntil(c.expiryDate, now);
    const who = c.ownerType === "PERSON" && c.user ? ` (${c.user.name})` : "";
    const message =
      days < 0
        ? `${c.name}${who} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
        : days === 0
          ? `${c.name}${who} expires today`
          : `${c.name}${who} expires in ${days} day${days === 1 ? "" : "s"}`;
    return {
      id: `cert-${c.id}`,
      severity: days < 0 ? "red" : "amber",
      category: "certification",
      message,
      href: "/certifications",
      urgencyDays: days,
    };
  });
}

async function overdueInvoiceAlerts(now: Date): Promise<AlertItem[]> {
  // Same "overdue" definition as finance.service.ts / invoice.service.ts:
  // explicitly OVERDUE, or unpaid/partially-paid and past its due date.
  const invoices = await db.invoice.findMany({
    where: {
      deletedAt: null,
      customer: { organisationId: ORG_ID, deletedAt: null },
      OR: [{ status: "OVERDUE" }, { status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { lt: now } }],
    },
    select: { id: true, invoiceNumber: true, amount: true, dueDate: true },
    orderBy: { dueDate: "asc" },
  });

  return invoices.map((inv) => {
    const overdueDays = Math.max(0, daysUntil(inv.dueDate, now) * -1);
    return {
      id: `invoice-${inv.id}`,
      severity: "red",
      category: "invoice",
      message: `Invoice ${inv.invoiceNumber} overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"} (${formatGBP(Number(inv.amount))})`,
      // There's no /invoices/[id] detail route -- deep-link via the
      // Invoices page's own search box (src/app/(crm)/invoices/page.tsx)
      // instead, which already filters by invoice number.
      href: `/invoices?q=${encodeURIComponent(inv.invoiceNumber)}`,
      urgencyDays: -overdueDays,
    };
  });
}

/** Secondary nudge: a sent/viewed quote the customer hasn't responded to in a while. Optional per the brief -- kept clearly lower-priority, appended after the primary alerts rather than interleaved. */
async function staleQuoteAlerts(now: Date): Promise<AlertItem[]> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - STALE_QUOTE_DAYS);

  const quotes = await db.quote.findMany({
    where: {
      organisationId: ORG_ID,
      deletedAt: null,
      customer: { deletedAt: null },
      status: { in: ["SENT", "VIEWED"] },
      updatedAt: { lte: cutoff },
    },
    select: { id: true, quoteNumber: true, updatedAt: true, customer: { select: { name: true } } },
    orderBy: { updatedAt: "asc" },
    take: 5,
  });

  return quotes.map((q) => {
    const days = Math.max(0, daysUntil(q.updatedAt, now) * -1);
    return {
      id: `quote-${q.id}`,
      severity: "amber",
      category: "quote",
      message: `Quote ${q.quoteNumber} (${q.customer.name}) awaiting response for ${days} days`,
      href: `/quotes/${q.id}`,
      urgencyDays: 0,
    };
  });
}

/** Secondary nudge: a job marked complete with no invoice raised yet. */
async function uninvoicedJobAlerts(): Promise<AlertItem[]> {
  const jobs = await db.job.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, customer: { deletedAt: null }, status: "COMPLETED", invoice: null },
    select: { id: true, jobNumber: true, customer: { select: { name: true } } },
    orderBy: { actualEnd: "asc" },
    take: 5,
  });

  return jobs.map((j) => ({
    id: `job-${j.id}`,
    severity: "amber",
    category: "job",
    message: `Job ${j.jobNumber} (${j.customer.name}) is complete but not yet invoiced`,
    href: `/jobs/${j.id}`,
    urgencyDays: 0,
  }));
}

/**
 * Everything the dashboard's "Alerts & Updates" box shows, most-urgent-first.
 * The two priority categories (certifications, overdue invoices) are sorted
 * together by urgencyDays ascending, so the most overdue/most expired items
 * lead regardless of category. The two secondary nudges are appended after
 * -- always lower priority, never competing with the primary alerts for the
 * top of the list, per the brief's "keep these optional/secondary".
 */
export async function getAlerts(): Promise<AlertItem[]> {
  const now = new Date();
  const [certs, invoices, quotes, jobs] = await Promise.all([
    certificationAlerts(now),
    overdueInvoiceAlerts(now),
    staleQuoteAlerts(now),
    uninvoicedJobAlerts(),
  ]);

  const primary = [...certs, ...invoices].sort((a, b) => a.urgencyDays - b.urgencyDays);
  return [...primary, ...quotes, ...jobs];
}
