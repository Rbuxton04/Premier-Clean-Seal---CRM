import { db } from "@/lib/db";
import { ORG_ID, getOrgSettings, applyVat } from "@/lib/settings";
import { nextDocumentNumber } from "@/lib/numbering";
import { isR2Configured, uploadBuffer } from "@/lib/storage/r2";
import { renderWarrantyPdfBuffer } from "@/lib/pdf/warranty-pdf";
import { renderInvoicePdfBuffer } from "@/lib/pdf/invoice-pdf";
import { applicationAreaLabels } from "@/validators/completion";
import type { CompletionInput } from "@/validators/completion";

function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

/** Finds a matching Product row, or creates one (manufacturer "Custom") for
 * a free-typed colour that isn't in the catalogue yet — so it's reusable
 * next time too. */
async function resolveProductId(m: { productId?: string; productText: string; colour: string }): Promise<string> {
  if (m.productId) return m.productId;
  const existing = await db.product.findFirst({
    where: { organisationId: ORG_ID, name: m.productText, colour: m.colour },
  });
  if (existing) return existing.id;
  const created = await db.product.create({
    data: { organisationId: ORG_ID, manufacturer: "Custom", name: m.productText, colour: m.colour },
  });
  return created.id;
}

export type FinishJobResult = {
  jobId: string;
  warrantyId: string;
  invoiceId: string;
  invoiceNumber: string;
  photosSaved: number;
  signatureSaved: boolean;
};

/**
 * The Milestone 6 "Finish & generate" action: marks the job completed and
 * creates everything downstream of that in one place — materials, warranty +
 * certificate, invoice, the property work-log entry, the next marketing
 * reminder, and the timeline trail. Photos and the signature are already
 * uploaded to R2 by the browser (see completion-wizard.tsx) by the time this
 * runs — this just records the resulting URLs as MediaFile rows.
 */
export async function finishJob(jobId: string, input: CompletionInput): Promise<FinishJobResult> {
  const job = await db.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { customer: true, property: true },
  });
  const org = await getOrgSettings();
  const actualEnd = input.actualEnd ?? new Date();
  const actualStart = input.actualStart ?? job.actualStart ?? job.scheduledStart ?? actualEnd;

  const resolvedMaterials = await Promise.all(
    input.materials.map(async (m) => ({ ...m, productId: await resolveProductId(m) }))
  );
  await db.materialUsage.createMany({
    data: resolvedMaterials.map((m) => ({
      jobId,
      productId: m.productId,
      batchNumber: m.batchNumber || null,
      applicationArea: m.applicationArea,
      quantityUsed: m.quantityUsed,
      unit: m.unit,
      cost: m.cost ?? null,
    })),
  });

  const signatureUrl: string | null = input.signatureUrl ?? null;
  if (signatureUrl) {
    await db.mediaFile.create({
      data: { organisationId: ORG_ID, jobId, customerId: job.customerId, kind: "SIGNATURE", url: signatureUrl, mimeType: "image/png", sizeBytes: 0 },
    });
  }

  let photosSaved = 0;
  for (const photo of input.photos ?? []) {
    await db.mediaFile.create({
      data: {
        organisationId: ORG_ID,
        jobId,
        customerId: job.customerId,
        kind: "PHOTO",
        category: photo.category,
        url: photo.url,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
      },
    });
    photosSaved++;
  }

  await db.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      actualStart,
      actualEnd,
      completionNotes: input.completionNotes || null,
      metresInstalled: input.metresInstalled ?? null,
      customerSignature: signatureUrl,
      satisfactionRating: input.satisfactionRating ?? null,
    },
  });

  const warrantyStart = actualEnd;
  const warrantyEnd = addMonths(warrantyStart, org.defaultWarrantyMonths);
  const areaSummary = Array.from(new Set(resolvedMaterials.map((m) => applicationAreaLabels[m.applicationArea]))).join(", ");
  const coverage = `${org.defaultWarrantyMonths}-month warranty against installation defects covering: ${areaSummary || "the areas sealed during this job"}.`;

  const warranty = await db.warranty.create({
    data: { jobId, startDate: warrantyStart, endDate: warrantyEnd, coverage },
  });

  try {
    const buffer = await renderWarrantyPdfBuffer({
      jobNumber: job.jobNumber,
      customerName: job.customer.name,
      propertyAddress: job.property ? `${job.property.addressLine1}, ${job.property.postcode}` : null,
      startDate: warrantyStart,
      endDate: warrantyEnd,
      coverage,
      materials: resolvedMaterials.map((m) => ({ productLabel: m.productText, colour: m.colour, area: applicationAreaLabels[m.applicationArea] })),
    });
    if (isR2Configured()) {
      const certificateUrl = await uploadBuffer(`jobs/${job.jobNumber}/warranty-certificate.pdf`, buffer, "application/pdf");
      await db.warranty.update({ where: { id: warranty.id }, data: { certificateUrl } });
    }
  } catch {
    // Best-effort — the warranty PDF route regenerates on demand regardless.
  }

  const price = Number(job.price);
  const depositPaid = Number(job.depositPaid);
  const subtotal = +(price - depositPaid).toFixed(2);
  const vat = applyVat(subtotal, org);
  const invoiceNumber = await nextDocumentNumber(ORG_ID, "invoice");
  const dueDate = new Date(actualEnd);
  dueDate.setDate(dueDate.getDate() + 14);

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      customerId: job.customerId,
      jobId,
      subtotal,
      vatApplied: vat.vatApplied,
      vatRatePercent: vat.vatRatePercent,
      vatAmount: vat.vatAmount,
      amount: vat.total,
      status: "UNPAID",
      dueDate,
    },
  });

  try {
    const buffer = await renderInvoicePdfBuffer({
      invoiceNumber,
      jobNumber: job.jobNumber,
      createdAt: invoice.createdAt,
      dueDate,
      customerName: job.customer.name,
      customerCompany: job.customer.company,
      propertyAddress: job.property ? `${job.property.addressLine1}, ${job.property.postcode}` : null,
      jobPrice: price,
      depositPaid,
      subtotal,
      vatApplied: vat.vatApplied,
      vatRatePercent: vat.vatRatePercent,
      vatAmount: vat.vatAmount,
      amount: vat.total,
    });
    if (isR2Configured()) {
      const pdfUrl = await uploadBuffer(`invoices/${invoiceNumber}.pdf`, buffer, "application/pdf");
      await db.invoice.update({ where: { id: invoice.id }, data: { pdfUrl } });
    }
  } catch {
    // Best-effort — the invoice PDF route regenerates on demand regardless.
  }

  const channels: Array<"EMAIL" | "SMS"> = [];
  if (job.customer.marketingEmail) channels.push("EMAIL");
  if (job.customer.marketingSms) channels.push("SMS");
  const reminderDue = addMonths(actualEnd, org.defaultReminderMonths);
  await db.marketingReminder.create({
    data: {
      organisationId: ORG_ID,
      customerId: job.customerId,
      jobId,
      dueDate: reminderDue,
      intervalMonths: org.defaultReminderMonths,
      channels,
      status: "SCHEDULED",
    },
  });

  if (job.propertyId && resolvedMaterials.length > 0) {
    const primary = resolvedMaterials[0];
    await db.propertyWorkLog.create({
      data: {
        propertyId: job.propertyId,
        description: `Job ${job.jobNumber} completed`,
        productId: primary.productId,
        productText: primary.productText,
        colour: primary.colour,
        area: primary.applicationArea,
        batchNumber: primary.batchNumber || null,
        completedAt: actualEnd,
      },
    });
  }

  await db.timelineEvent.createMany({
    data: [
      { customerId: job.customerId, jobId, type: "JOB_COMPLETED", title: `Job ${job.jobNumber} completed` },
      { customerId: job.customerId, jobId, type: "WARRANTY_ISSUED", title: `Warranty issued for job ${job.jobNumber} (${org.defaultWarrantyMonths} months)` },
      { customerId: job.customerId, jobId, type: "INVOICE_RAISED", title: `Invoice ${invoiceNumber} raised` },
      {
        customerId: job.customerId,
        jobId,
        type: "REMINDER_SCHEDULED",
        title: `${org.defaultReminderMonths}-month reminder scheduled for ${reminderDue.toLocaleDateString("en-GB")}`,
      },
    ],
  });

  return {
    jobId,
    warrantyId: warranty.id,
    invoiceId: invoice.id,
    invoiceNumber,
    photosSaved,
    signatureSaved: Boolean(signatureUrl),
  };
}
