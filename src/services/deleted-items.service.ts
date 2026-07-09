import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts.
export type DeletedJobItem = { id: string; jobNumber: string; customerName: string; deletedAt: Date; deletedByName: string | null };
export type DeletedQuoteItem = { id: string; quoteNumber: string; customerName: string; deletedAt: Date; deletedByName: string | null };
export type DeletedInvoiceItem = { id: string; invoiceNumber: string; customerName: string; deletedAt: Date; deletedByName: string | null };
export type DeletedPropertyItem = { id: string; address: string; customerId: string; customerName: string; deletedAt: Date; deletedByName: string | null };

export type DeletedItems = {
  jobs: DeletedJobItem[];
  quotes: DeletedQuoteItem[];
  invoices: DeletedInvoiceItem[];
  properties: DeletedPropertyItem[];
};

/** deletedById is a plain scalar (no relation — see the schema comment on Job.deletedById), so names are resolved with a single follow-up lookup. */
async function resolveDeletedByNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => id != null)));
  if (uniqueIds.length === 0) return new Map();
  const users = await db.user.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Admin-only "Deleted items" view — every soft-deleted Job/Quote/Invoice in the org, newest deletion first, with who deleted it and when. */
export async function listDeletedItems(): Promise<DeletedItems> {
  const [jobs, quotes, invoices, properties] = await Promise.all([
    db.job.findMany({
      where: { organisationId: ORG_ID, deletedAt: { not: null } },
      select: { id: true, jobNumber: true, deletedAt: true, deletedById: true, customer: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
    }),
    db.quote.findMany({
      where: { organisationId: ORG_ID, deletedAt: { not: null } },
      select: { id: true, quoteNumber: true, deletedAt: true, deletedById: true, customer: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
    }),
    db.invoice.findMany({
      where: { customer: { organisationId: ORG_ID }, deletedAt: { not: null } },
      select: { id: true, invoiceNumber: true, deletedAt: true, deletedById: true, customer: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
    }),
    db.property.findMany({
      where: { customer: { organisationId: ORG_ID }, deletedAt: { not: null } },
      select: {
        id: true,
        addressLine1: true,
        postcode: true,
        deletedAt: true,
        deletedById: true,
        customerId: true,
        customer: { select: { name: true } },
      },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  const nameById = await resolveDeletedByNames([
    ...jobs.map((j) => j.deletedById),
    ...quotes.map((q) => q.deletedById),
    ...invoices.map((i) => i.deletedById),
    ...properties.map((p) => p.deletedById),
  ]);

  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      customerName: j.customer.name,
      deletedAt: j.deletedAt!,
      deletedByName: j.deletedById ? nameById.get(j.deletedById) ?? null : null,
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      customerName: q.customer.name,
      deletedAt: q.deletedAt!,
      deletedByName: q.deletedById ? nameById.get(q.deletedById) ?? null : null,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: i.customer.name,
      deletedAt: i.deletedAt!,
      deletedByName: i.deletedById ? nameById.get(i.deletedById) ?? null : null,
    })),
    properties: properties.map((p) => ({
      id: p.id,
      address: `${p.addressLine1}, ${p.postcode}`,
      customerId: p.customerId,
      customerName: p.customer.name,
      deletedAt: p.deletedAt!,
      deletedByName: p.deletedById ? nameById.get(p.deletedById) ?? null : null,
    })),
  };
}
