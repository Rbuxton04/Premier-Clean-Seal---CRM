import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { isResendConfigured, sendPortalLinkEmail as sendPortalLinkEmailViaResend } from "@/lib/email/resend";
import { getQuote, recordQuoteViewedById, type QuoteDetail } from "@/services/quote.service";
import { listDocuments, type DocumentItem } from "@/services/media.service";
import { createRebookingEnquiry } from "@/services/marketing.service";
import type { PortalContactInput, PortalRequestInput, PortalRequestKind } from "@/validators/portal";

// ---------------------------------------------------------------------------
// SECURITY BOUNDARY: resolvePortalToken() is the only gate every portal page
// and server action goes through. It is the sole source of a customerId used
// anywhere in this file — nothing here ever accepts a customerId argument
// straight from a client without it having first come out of this function
// (or, for the staff-facing functions at the bottom, straight from a
// Clerk-protected CRM page). Every query below is additionally scoped to
// ORG_ID and/or a relation owned by that exact customerId.
// ---------------------------------------------------------------------------

const PORTAL_SCOPE = "portal";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export type PortalCustomer = { id: string; name: string; email: string | null; phone: string | null };

/** Resolves a portal token to exactly one customer, or null on anything invalid
 * (unknown token, expired, wrong scope, soft-deleted customer). Callers must
 * show a generic "link not found" message on null — never leak which part failed. */
export async function resolvePortalToken(token: string): Promise<PortalCustomer | null> {
  const portalToken = await db.portalToken.findFirst({
    where: { token, scope: { has: PORTAL_SCOPE }, expiresAt: { gt: new Date() } },
    select: { customerId: true },
  });
  if (!portalToken) return null;

  return db.customer.findFirst({
    where: { id: portalToken.customerId, organisationId: ORG_ID, deletedAt: null },
    select: { id: true, name: true, email: true, phone: true },
  });
}

// ---------------------------------------------------------------------------
// Portal home
// ---------------------------------------------------------------------------

export type PortalPhotoPair = { jobId: string; jobNumber: string; completedAt: Date | null; beforeUrl: string; afterUrl: string };

async function getSharedPhotoPairs(customerId: string): Promise<PortalPhotoPair[]> {
  const photos = await db.mediaFile.findMany({
    where: { customerId, kind: "PHOTO", sharedToPortal: true, pairedWithId: { not: null } },
    select: {
      id: true,
      url: true,
      category: true,
      pairedWithId: true,
      job: { select: { id: true, jobNumber: true, actualEnd: true } },
    },
  });

  const byId = new Map(photos.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const pairs: PortalPhotoPair[] = [];

  for (const p of photos) {
    if (seen.has(p.id) || !p.pairedWithId || !p.job) continue;
    const other = byId.get(p.pairedWithId);
    if (!other) continue; // only shown when BOTH sides of the pair are shared
    seen.add(p.id);
    seen.add(other.id);

    const before = p.category === "AFTER" ? other : p;
    const after = p.category === "AFTER" ? p : other;
    pairs.push({ jobId: p.job.id, jobNumber: p.job.jobNumber, completedAt: p.job.actualEnd, beforeUrl: before.url, afterUrl: after.url });
  }

  return pairs;
}

const PORTAL_DOCUMENT_CATEGORIES = new Set(["QUOTE_PDF", "INVOICE_PDF", "CERTIFICATE"]);

export type PortalHome = {
  customer: PortalCustomer;
  quotesAwaitingApproval: QuoteDetail[];
  documents: DocumentItem[];
  photoPairs: PortalPhotoPair[];
  properties: Array<{ id: string; addressLine1: string; postcode: string }>;
};

export async function getPortalHome(customerId: string): Promise<PortalHome> {
  const [customer, awaitingIds, allDocuments, photoPairs, properties] = await Promise.all([
    db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { id: true, name: true, email: true, phone: true } }),
    db.quote.findMany({
      where: { organisationId: ORG_ID, customerId, status: { in: ["SENT", "VIEWED"] } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
    listDocuments({ customerId }),
    getSharedPhotoPairs(customerId),
    db.property.findMany({ where: { customerId }, select: { id: true, addressLine1: true, postcode: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const quoteDetails = (await Promise.all(awaitingIds.map((q) => getQuote(q.id)))).filter((q): q is QuoteDetail => q !== null);
  const now = new Date();
  const quotesAwaitingApproval = quoteDetails.filter((q) => !q.expiresAt || q.expiresAt > now);

  // Mark any SENT quote as VIEWED now the customer has actually opened the portal.
  await Promise.all(quotesAwaitingApproval.filter((q) => q.status === "SENT").map((q) => recordQuoteViewedById(q.id)));

  const documents = allDocuments.filter((d) => PORTAL_DOCUMENT_CATEGORIES.has(d.category));

  return { customer, quotesAwaitingApproval, documents, photoPairs, properties };
}

// ---------------------------------------------------------------------------
// Self-service actions
// ---------------------------------------------------------------------------

export async function updatePortalContactDetails(customerId: string, data: PortalContactInput): Promise<void> {
  await db.customer.update({
    where: { id: customerId },
    data: { name: data.name, email: data.email || null, phone: data.phone || null },
  });
  await db.timelineEvent.create({
    data: { customerId, type: "CONTACT_UPDATED", title: "Customer updated their own contact details via the portal" },
  });
}

export async function sendPortalMessage(customerId: string, message: string): Promise<void> {
  await db.communicationLog.create({
    data: { customerId, direction: "INBOUND", channel: "EMAIL", subject: "Portal message", body: message },
  });
}

const REQUEST_KIND_LABEL: Record<PortalRequestKind, string> = {
  quote: "New quote requested via the customer portal",
  maintenance: "Maintenance / warranty check requested via the customer portal",
};

export async function createPortalRequest(customerId: string, kind: PortalRequestKind, data: PortalRequestInput): Promise<{ enquiryId: string }> {
  const description = `${REQUEST_KIND_LABEL[kind]}: ${data.description}`;
  return createRebookingEnquiry(customerId, { propertyId: data.propertyId, workTypes: data.workTypes, description }, "the customer portal");
}

// ---------------------------------------------------------------------------
// Staff-facing token management (called from Clerk-protected CRM pages only)
// ---------------------------------------------------------------------------

export type PortalTokenSummary = { id: string; token: string; url: string; expiresAt: Date; createdAt: Date; revoked: boolean };

export async function listPortalTokens(customerId: string): Promise<PortalTokenSummary[]> {
  const rows = await db.portalToken.findMany({
    where: { customerId, scope: { has: PORTAL_SCOPE } },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    url: `${appUrl()}/portal/${r.token}`,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    revoked: r.expiresAt <= now,
  }));
}

export async function revokePortalToken(tokenId: string): Promise<void> {
  await db.portalToken.update({ where: { id: tokenId }, data: { expiresAt: new Date() } });
}

export type SendPortalLinkResult = { url: string; emailed: boolean };

export async function sendPortalLinkToCustomer(customerId: string, expiryDays: number): Promise<SendPortalLinkResult> {
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId } });

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  await db.portalToken.create({ data: { customerId, token, scope: [PORTAL_SCOPE], expiresAt } });
  const url = `${appUrl()}/portal/${token}`;

  let emailed = false;
  if (isResendConfigured() && customer.email) {
    try {
      await sendPortalLinkEmailViaResend({ to: customer.email, customerName: customer.name, url });
      emailed = true;
    } catch {
      emailed = false;
    }
  }

  await db.timelineEvent.create({
    data: {
      customerId,
      type: "PORTAL_LINK_SENT",
      title: emailed ? "Portal link emailed to customer" : `Portal link ready to share: ${url}`,
    },
  });

  return { url, emailed };
}
