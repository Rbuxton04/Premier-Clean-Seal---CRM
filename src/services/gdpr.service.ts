import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";

/**
 * Full data export for a customer — everything the business holds about
 * them, for a GDPR Subject Access Request. Media/document entries include
 * only their stored URL and metadata, never re-fetch/re-embed binary
 * content. ADMIN-only; callers must log the export in AuditLog.
 */
export async function exportCustomerData(customerId: string): Promise<Record<string, unknown> | null> {
  const customer = await db.customer.findFirst({
    where: { id: customerId, organisationId: ORG_ID },
    include: {
      properties: { include: { workLogEntries: true } },
      tags: { select: { id: true, name: true } },
      timeline: { orderBy: { createdAt: "asc" } },
      communications: { orderBy: { createdAt: "asc" } },
      enquiries: true,
      quotes: { include: { lineItems: true } },
      jobs: { include: { materials: { include: { product: true } }, warranty: true, invoice: true } },
      invoices: true,
      mediaFiles: { select: { id: true, kind: true, category: true, url: true, createdAt: true } },
      portalTokens: { select: { id: true, scope: true, expiresAt: true, createdAt: true } },
      reminders: true,
    },
  });
  if (!customer) return null;

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: customer.id,
      name: customer.name,
      company: customer.company,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
      marketingEmail: customer.marketingEmail,
      marketingSms: customer.marketingSms,
      consentAt: customer.consentAt,
      totalSpend: customer.totalSpend,
      createdAt: customer.createdAt,
      tags: customer.tags,
    },
    properties: customer.properties,
    enquiries: customer.enquiries,
    quotes: customer.quotes,
    jobs: customer.jobs,
    invoices: customer.invoices,
    timeline: customer.timeline,
    communications: customer.communications,
    mediaFiles: customer.mediaFiles,
    portalLinks: customer.portalTokens,
    marketingReminders: customer.reminders,
  };
}

export type EraseResult = { ok: true } | { ok: false; message: string };

const ERASED_PLACEHOLDER = "Erased (GDPR request)";

/**
 * Right-to-be-forgotten: scrubs personal identifiers from the customer's own
 * record, their raw enquiry submissions, and their property addresses; hard
 * deletes portal tokens, communications, and timeline entries (none needed
 * for accounting); unlinks (but does not delete) media files so job photo
 * history stays intact. Quotes/jobs/invoices/warranties are deliberately left
 * alone — those are financial/business records with a legitimate retention
 * need, and they carry no personal identifiers of their own once the
 * Customer row they join to has been scrubbed.
 */
export async function eraseCustomer(customerId: string): Promise<EraseResult> {
  const customer = await db.customer.findFirst({ where: { id: customerId, organisationId: ORG_ID } });
  if (!customer) return { ok: false, message: "Customer not found." };

  await db.$transaction([
    db.customer.update({
      where: { id: customerId },
      data: {
        name: ERASED_PLACEHOLDER,
        company: null,
        phone: null,
        email: null,
        notes: null,
        marketingEmail: false,
        marketingSms: false,
        consentAt: null,
        deletedAt: new Date(),
        anonymisedAt: new Date(),
      },
    }),
    db.enquiry.updateMany({
      where: { customerId },
      data: { name: ERASED_PLACEHOLDER, phone: "", email: "", addressText: ERASED_PLACEHOLDER, postcode: "" },
    }),
    db.property.updateMany({
      where: { customerId },
      data: { addressLine1: ERASED_PLACEHOLDER, addressLine2: null, city: null, postcode: "" },
    }),
    db.portalToken.deleteMany({ where: { customerId } }),
    db.communicationLog.deleteMany({ where: { customerId } }),
    db.timelineEvent.deleteMany({ where: { customerId } }),
    db.mediaFile.updateMany({ where: { customerId }, data: { customerId: null } }),
  ]);

  return { ok: true };
}
