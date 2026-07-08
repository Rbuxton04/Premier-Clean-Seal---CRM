import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { renderInvoicePdfBuffer, type InvoicePdfData } from "@/lib/pdf/invoice-pdf";

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts. Invoice has no organisationId column of its own, so
// tenancy is scoped through the customer relation.
export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  amount: unknown;
  status: string;
  dueDate: Date;
  createdAt: Date;
  customer: { id: string; name: string };
  job: { id: string; jobNumber: string } | null;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  subtotal: unknown;
  vatApplied: boolean;
  vatRatePercent: unknown;
  vatAmount: unknown;
  amount: unknown;
  status: string;
  dueDate: Date;
  paidAt: Date | null;
  pdfUrl: string | null;
  createdAt: Date;
  customer: { id: string; name: string; company: string | null };
  job: {
    id: string;
    jobNumber: string;
    price: unknown;
    depositPaid: unknown;
    property: { addressLine1: string; postcode: string } | null;
  } | null;
};

const listInclude = {
  customer: { select: { id: true, name: true } },
  job: { select: { id: true, jobNumber: true } },
};

export async function listInvoices(): Promise<InvoiceListItem[]> {
  const rows = await db.invoice.findMany({
    where: { customer: { organisationId: ORG_ID }, deletedAt: null },
    include: listInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows as InvoiceListItem[];
}

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const row = await db.invoice.findFirst({
    where: { id, customer: { organisationId: ORG_ID }, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      job: {
        select: {
          id: true,
          jobNumber: true,
          price: true,
          depositPaid: true,
          property: { select: { addressLine1: true, postcode: true } },
        },
      },
    },
  });
  return row as InvoiceDetail | null;
}

export async function getInvoiceByJobId(jobId: string): Promise<InvoiceDetail | null> {
  const row = await db.invoice.findFirst({
    where: { jobId, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      job: {
        select: {
          id: true,
          jobNumber: true,
          price: true,
          depositPaid: true,
          property: { select: { addressLine1: true, postcode: true } },
        },
      },
    },
  });
  return row as InvoiceDetail | null;
}

/**
 * Soft-delete ("void"): hides the invoice everywhere (it stops matching
 * every deletedAt: null query above) without touching its customer or job
 * — neither cascades, and the invoice number is never reused. Invoices are
 * financial records generally required to be retained (UK: ~6 years), so
 * this only ever hides, never erases — see the schema comment on
 * Invoice.deletedAt. Callers are responsible for the admin-only check;
 * this function trusts its caller.
 */
export async function softDeleteInvoice(id: string, userId: string | null): Promise<void> {
  const invoice = await db.invoice.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: userId },
  });
  const actor = userId ? await db.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  await db.timelineEvent.create({
    data: {
      customerId: invoice.customerId,
      type: "INVOICE_DELETED",
      title: `Invoice ${invoice.invoiceNumber} voided${actor ? ` by ${actor.name}` : ""}`,
    },
  });
}

export async function restoreInvoice(id: string): Promise<void> {
  const invoice = await db.invoice.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  await db.timelineEvent.create({
    data: { customerId: invoice.customerId, type: "INVOICE_RESTORED", title: `Invoice ${invoice.invoiceNumber} restored` },
  });
}

export async function getInvoicePdfBuffer(invoice: InvoiceDetail): Promise<Buffer> {
  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    jobNumber: invoice.job?.jobNumber ?? null,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    customerName: invoice.customer.name,
    customerCompany: invoice.customer.company,
    propertyAddress: invoice.job?.property ? `${invoice.job.property.addressLine1}, ${invoice.job.property.postcode}` : null,
    jobPrice: invoice.job ? Number(invoice.job.price) : Number(invoice.amount),
    depositPaid: invoice.job ? Number(invoice.job.depositPaid) : 0,
    subtotal: Number(invoice.subtotal),
    vatApplied: invoice.vatApplied,
    vatRatePercent: Number(invoice.vatRatePercent),
    vatAmount: Number(invoice.vatAmount),
    amount: Number(invoice.amount),
  };
  return renderInvoicePdfBuffer(data);
}
