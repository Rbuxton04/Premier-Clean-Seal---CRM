import { randomBytes } from "crypto";
import type { QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID, getOrgSettings, applyVat } from "@/lib/settings";
import { nextDocumentNumber } from "@/lib/numbering";
import { isSupabaseStorageConfigured, uploadFile } from "@/lib/storage/supabase";
import { isResendConfigured, sendQuoteEmail } from "@/lib/email/resend";
import { renderQuotePdfBuffer, type QuotePdfData } from "@/lib/pdf/quote-pdf";
import type { QuoteFormInput } from "@/validators/quote";
import type { Findings } from "@/lib/ai/provider";

const APPROVAL_WINDOW_DAYS = 30;
// Draft rates for AI-prefilled line items — a starting point for staff to
// adjust, never charged automatically.
const RATE_PER_METRE = 8;
const RATE_PER_HOUR = 45;

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts.
export type QuoteListItem = {
  id: string;
  quoteNumber: string;
  status: string;
  total: unknown;
  createdAt: Date;
  expiresAt: Date | null;
  customer: { id: string; name: string; company: string | null };
};

export type QuoteLineItemDetail = {
  id: string;
  description: string;
  quantity: unknown;
  unit: string;
  unitPrice: unknown;
  total: unknown;
  sortOrder: number;
};

export type QuoteDetail = {
  id: string;
  organisationId: string;
  quoteNumber: string;
  status: string;
  scopeOfWorks: string;
  subtotal: unknown;
  vatApplied: boolean;
  vatRatePercent: unknown;
  vatAmount: unknown;
  total: unknown;
  depositAmount: unknown;
  terms: string | null;
  warrantyMonths: number | null;
  pdfUrl: string | null;
  approvalToken: string | null;
  approvedAt: Date | null;
  approvedName: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: string; name: string; company: string | null; email: string | null; phone: string | null };
  enquiry: { id: string; addressText: string; postcode: string } | null;
  lineItems: QuoteLineItemDetail[];
  job: { id: string } | null;
};

const detailInclude = {
  customer: { select: { id: true, name: true, company: true, email: true, phone: true } },
  enquiry: { select: { id: true, addressText: true, postcode: true } },
  lineItems: { orderBy: { sortOrder: "asc" as const } },
  job: { select: { id: true } },
};

export async function listQuotes(status?: string): Promise<QuoteListItem[]> {
  const rows = await db.quote.findMany({
    where: { organisationId: ORG_ID, deletedAt: null, customer: { deletedAt: null }, ...(status ? { status: status as QuoteStatus } : {}) },
    include: { customer: { select: { id: true, name: true, company: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows as QuoteListItem[];
}

export async function getQuote(id: string): Promise<QuoteDetail | null> {
  const row = await db.quote.findFirst({ where: { id, organisationId: ORG_ID, deletedAt: null, customer: { deletedAt: null } }, include: detailInclude });
  return row as QuoteDetail | null;
}

export async function getQuoteByToken(token: string): Promise<QuoteDetail | null> {
  const row = await db.quote.findFirst({ where: { approvalToken: token, deletedAt: null, customer: { deletedAt: null } }, include: detailInclude });
  return row as QuoteDetail | null;
}

/** Status as it should be displayed — expiry is computed on read, never mutated in the DB. */
export function displayStatus(quote: Pick<QuoteDetail, "status" | "expiresAt">): string {
  if ((quote.status === "SENT" || quote.status === "VIEWED") && quote.expiresAt && quote.expiresAt < new Date()) {
    return "EXPIRED";
  }
  return quote.status;
}

function computeLineItems(lineItems: QuoteFormInput["lineItems"]) {
  return lineItems.map((item, i) => ({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    total: +(item.quantity * item.unitPrice).toFixed(2),
    sortOrder: i,
  }));
}

export async function createQuote(data: QuoteFormInput): Promise<{ id: string }> {
  const org = await getOrgSettings();
  const lineItems = computeLineItems(data.lineItems);
  const subtotal = +lineItems.reduce((sum, i) => sum + i.total, 0).toFixed(2);
  const vat = applyVat(subtotal, org);
  const quoteNumber = await nextDocumentNumber(ORG_ID, "quote");

  const quote = await db.quote.create({
    data: {
      organisationId: ORG_ID,
      quoteNumber,
      customerId: data.customerId,
      enquiryId: data.enquiryId || null,
      scopeOfWorks: data.scopeOfWorks,
      subtotal,
      vatApplied: vat.vatApplied,
      vatRatePercent: vat.vatRatePercent,
      vatAmount: vat.vatAmount,
      total: vat.total,
      depositAmount: data.depositAmount ?? null,
      terms: data.terms || null,
      warrantyMonths: data.warrantyMonths ?? org.defaultWarrantyMonths,
      lineItems: { create: lineItems },
    },
    select: { id: true },
  });

  await db.timelineEvent.create({
    data: { customerId: data.customerId, type: "QUOTE_CREATED", title: `Quote ${quoteNumber} created` },
  });

  return quote;
}

export async function updateQuote(id: string, data: QuoteFormInput): Promise<void> {
  const org = await getOrgSettings();
  const lineItems = computeLineItems(data.lineItems);
  const subtotal = +lineItems.reduce((sum, i) => sum + i.total, 0).toFixed(2);
  const vat = applyVat(subtotal, org);

  await db.$transaction([
    db.quoteLineItem.deleteMany({ where: { quoteId: id } }),
    db.quote.update({
      where: { id },
      data: {
        scopeOfWorks: data.scopeOfWorks,
        subtotal,
        vatApplied: vat.vatApplied,
        vatRatePercent: vat.vatRatePercent,
        vatAmount: vat.vatAmount,
        total: vat.total,
        depositAmount: data.depositAmount ?? null,
        terms: data.terms || null,
        warrantyMonths: data.warrantyMonths ?? org.defaultWarrantyMonths,
        lineItems: { create: lineItems },
      },
    }),
  ]);
}

async function buildPdfData(quote: QuoteDetail): Promise<QuotePdfData> {
  const property = quote.enquiry ? `${quote.enquiry.addressText}, ${quote.enquiry.postcode}` : null;
  return {
    quoteNumber: quote.quoteNumber,
    createdAt: quote.createdAt,
    expiresAt: quote.expiresAt,
    customerName: quote.customer.name,
    customerCompany: quote.customer.company,
    propertyAddress: property,
    scopeOfWorks: quote.scopeOfWorks,
    lineItems: quote.lineItems.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unit: i.unit,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    subtotal: Number(quote.subtotal),
    vatApplied: quote.vatApplied,
    vatRatePercent: Number(quote.vatRatePercent),
    vatAmount: Number(quote.vatAmount),
    total: Number(quote.total),
    depositAmount: quote.depositAmount != null ? Number(quote.depositAmount) : null,
    terms: quote.terms,
    warrantyMonths: quote.warrantyMonths,
    approvalUrl: quote.approvalToken ? `${process.env.APP_URL ?? "http://localhost:3000"}/quote/${quote.approvalToken}` : undefined,
  };
}

export async function getQuotePdfBuffer(quote: QuoteDetail): Promise<Buffer> {
  const data = await buildPdfData(quote);
  return renderQuotePdfBuffer(data);
}

export type SendQuoteResult = { approvalUrl: string; emailed: boolean };

export async function sendQuote(id: string): Promise<SendQuoteResult> {
  const quote = await getQuote(id);
  if (!quote) throw new Error("Quote not found");

  const token = quote.approvalToken ?? randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + APPROVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  await db.quote.update({
    where: { id },
    data: { status: (quote.status === "DRAFT" ? "SENT" : quote.status) as QuoteStatus, approvalToken: token, expiresAt },
  });

  const refreshed = (await getQuote(id))!;
  const approvalUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/quote/${token}`;

  // PDF persistence to storage is best-effort — on-demand generation via the
  // download routes works regardless, so a failure here never blocks sending.
  if (isSupabaseStorageConfigured()) {
    try {
      const buffer = await getQuotePdfBuffer(refreshed);
      const url = await uploadFile(`quotes/${refreshed.quoteNumber}.pdf`, buffer, "application/pdf");
      await db.quote.update({ where: { id }, data: { pdfUrl: url } });
    } catch {
      // Seam not implemented yet — ignore, PDF still generates on demand.
    }
  }

  let emailed = false;
  if (isResendConfigured() && refreshed.customer.email) {
    try {
      const buffer = await getQuotePdfBuffer(refreshed);
      await sendQuoteEmail({
        to: refreshed.customer.email,
        customerName: refreshed.customer.name,
        quoteNumber: refreshed.quoteNumber,
        approvalUrl,
        pdfBuffer: buffer,
      });
      emailed = true;
    } catch {
      emailed = false;
    }
  }

  await db.timelineEvent.create({
    data: {
      customerId: quote.customer.id,
      type: "QUOTE_SENT",
      title: emailed
        ? `Quote ${quote.quoteNumber} emailed to customer`
        : `Quote ${quote.quoteNumber} ready to send — approval link: ${approvalUrl}`,
    },
  });

  return { approvalUrl, emailed };
}

export async function recordQuoteViewed(token: string): Promise<void> {
  const quote = await db.quote.findFirst({
    where: { approvalToken: token, deletedAt: null },
    select: { id: true, status: true, customerId: true, quoteNumber: true },
  });
  if (!quote || quote.status !== "SENT") return;

  await db.quote.update({ where: { id: quote.id }, data: { status: "VIEWED" } });
  await db.timelineEvent.create({
    data: { customerId: quote.customerId, type: "QUOTE_VIEWED", title: `Quote ${quote.quoteNumber} viewed by customer` },
  });
}

/** Same effect as recordQuoteViewed, keyed by quoteId — used by the customer
 * portal, which authorises by (quoteId, customerId) rather than the quote's
 * own separate approval token. Safe to call repeatedly (no-ops once viewed). */
export async function recordQuoteViewedById(quoteId: string): Promise<void> {
  const quote = await db.quote.findUnique({ where: { id: quoteId }, select: { id: true, status: true, customerId: true, quoteNumber: true, deletedAt: true } });
  if (!quote || quote.deletedAt || quote.status !== "SENT") return;

  await db.quote.update({ where: { id: quote.id }, data: { status: "VIEWED" } });
  await db.timelineEvent.create({
    data: { customerId: quote.customerId, type: "QUOTE_VIEWED", title: `Quote ${quote.quoteNumber} viewed by customer via the portal` },
  });
}

export type ApprovalResult = { ok: true } | { ok: false; message: string };

export async function approveQuote(token: string, name: string, ip: string | null): Promise<ApprovalResult> {
  const quote = await db.quote.findFirst({ where: { approvalToken: token, deletedAt: null } });
  if (!quote) return { ok: false, message: "Quote not found." };
  if (displayStatus(quote) === "EXPIRED") return { ok: false, message: "This quote has expired." };
  if (quote.status === "APPROVED" || quote.status === "REJECTED") return { ok: false, message: "This quote has already been actioned." };

  await db.quote.update({
    where: { id: quote.id },
    data: { status: "APPROVED", approvedAt: new Date(), approvedName: name, approvedIp: ip },
  });
  await db.timelineEvent.create({
    data: { customerId: quote.customerId, type: "QUOTE_APPROVED", title: `Quote ${quote.quoteNumber} approved by ${name}` },
  });
  return { ok: true };
}

export async function rejectQuote(token: string, reason: string | undefined): Promise<ApprovalResult> {
  const quote = await db.quote.findFirst({ where: { approvalToken: token, deletedAt: null } });
  if (!quote) return { ok: false, message: "Quote not found." };
  if (quote.status === "APPROVED" || quote.status === "REJECTED") return { ok: false, message: "This quote has already been actioned." };

  await db.quote.update({ where: { id: quote.id }, data: { status: "REJECTED" } });
  await db.timelineEvent.create({
    data: {
      customerId: quote.customerId,
      type: "QUOTE_REJECTED",
      title: `Quote ${quote.quoteNumber} declined by customer${reason ? `: ${reason}` : ""}`,
    },
  });
  return { ok: true };
}

/**
 * Portal counterpart to approveQuote/rejectQuote — authorised by (quoteId,
 * customerId) instead of the quote's own separate approval token, since the
 * portal already proves "you are this customer" via its own PortalToken.
 * Never trust a customerId the caller didn't derive from a resolved token.
 */
export async function approveQuoteForCustomer(quoteId: string, customerId: string, name: string, ip: string | null): Promise<ApprovalResult> {
  const quote = await db.quote.findFirst({ where: { id: quoteId, customerId, deletedAt: null } });
  if (!quote) return { ok: false, message: "Quote not found." };
  if (displayStatus(quote) === "EXPIRED") return { ok: false, message: "This quote has expired." };
  if (quote.status === "APPROVED" || quote.status === "REJECTED") return { ok: false, message: "This quote has already been actioned." };

  await db.quote.update({
    where: { id: quote.id },
    data: { status: "APPROVED", approvedAt: new Date(), approvedName: name, approvedIp: ip },
  });
  await db.timelineEvent.create({
    data: { customerId, type: "QUOTE_APPROVED", title: `Quote ${quote.quoteNumber} approved by ${name} via the customer portal` },
  });
  return { ok: true };
}

export async function rejectQuoteForCustomer(quoteId: string, customerId: string, reason: string | undefined): Promise<ApprovalResult> {
  const quote = await db.quote.findFirst({ where: { id: quoteId, customerId, deletedAt: null } });
  if (!quote) return { ok: false, message: "Quote not found." };
  if (quote.status === "APPROVED" || quote.status === "REJECTED") return { ok: false, message: "This quote has already been actioned." };

  await db.quote.update({ where: { id: quote.id }, data: { status: "REJECTED" } });
  await db.timelineEvent.create({
    data: {
      customerId,
      type: "QUOTE_REJECTED",
      title: `Quote ${quote.quoteNumber} declined by customer via the portal${reason ? `: ${reason}` : ""}`,
    },
  });
  return { ok: true };
}

/**
 * Soft-delete: hides the quote everywhere (it stops matching every
 * deletedAt: null query above) without touching its customer or any job
 * already converted from it — neither cascades. Callers are responsible
 * for the admin-only check; this function trusts its caller.
 */
export async function softDeleteQuote(id: string, userId: string | null): Promise<void> {
  const quote = await db.quote.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: userId },
  });
  const actor = userId ? await db.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  await db.timelineEvent.create({
    data: {
      customerId: quote.customerId,
      type: "QUOTE_DELETED",
      title: `Quote ${quote.quoteNumber} deleted${actor ? ` by ${actor.name}` : ""}`,
    },
  });
}

export async function restoreQuote(id: string): Promise<void> {
  const quote = await db.quote.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  await db.timelineEvent.create({
    data: { customerId: quote.customerId, type: "QUOTE_RESTORED", title: `Quote ${quote.quoteNumber} restored` },
  });
}

export type QuoteDraft = {
  customerId: string;
  enquiryId: string;
  scopeOfWorks: string;
  terms: string;
  warrantyMonths: number;
  lineItems: Array<{ description: string; quantity: number; unit: string; unitPrice: number }>;
};

/** Assembles a "Create quote from this" prefill from an enquiry (and its AIAnalysis, if run). */
export async function buildDraftFromEnquiry(enquiryId: string): Promise<QuoteDraft | null> {
  const enquiry = await db.enquiry.findUnique({
    where: { id: enquiryId },
    include: { aiAnalysis: true },
  });
  if (!enquiry || !enquiry.customerId) return null;

  const org = await getOrgSettings();
  const analysis = enquiry.aiAnalysis;

  if (!analysis) {
    return {
      customerId: enquiry.customerId,
      enquiryId: enquiry.id,
      scopeOfWorks: enquiry.description,
      terms: "",
      warrantyMonths: org.defaultWarrantyMonths,
      lineItems: [{ description: "Silicone sealant work", quantity: 1, unit: "each", unitPrice: 0 }],
    };
  }

  const findings = analysis.findings as unknown as Findings;
  const suggestedProducts = analysis.suggestedProducts as unknown as Array<{ label: string }>;
  const productLabel = suggestedProducts.length ? suggestedProducts.map((p) => p.label).join(", ") : "Sanitary-grade silicone";
  const colourLabel = analysis.suggestedColours.length ? ` (${analysis.suggestedColours.join(", ")})` : "";

  const lineItems: QuoteDraft["lineItems"] = [];
  if (analysis.estimatedMetres != null) {
    lineItems.push({
      description: `Cut out and reseal — ${productLabel}${colourLabel}`,
      quantity: Number(analysis.estimatedMetres),
      unit: "metres",
      unitPrice: RATE_PER_METRE,
    });
  }
  if (analysis.suggestedLabourHrs != null) {
    lineItems.push({
      description: "Labour",
      quantity: Number(analysis.suggestedLabourHrs),
      unit: "hours",
      unitPrice: RATE_PER_HOUR,
    });
  }
  if (lineItems.length === 0) {
    lineItems.push({ description: productLabel + colourLabel, quantity: 1, unit: "each", unitPrice: 0 });
  }

  const safetyNote = findings.safetyIssues.length ? `\n\nSafety notes: ${findings.safetyIssues.join("; ")}` : "";

  return {
    customerId: enquiry.customerId,
    enquiryId: enquiry.id,
    scopeOfWorks: `${analysis.jobSummary}\n\n${analysis.estimatedWork}${safetyNote}`,
    terms: analysis.quoteNotes ?? "",
    warrantyMonths: org.defaultWarrantyMonths,
    lineItems,
  };
}
