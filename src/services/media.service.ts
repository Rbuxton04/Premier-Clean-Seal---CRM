import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import type { UploadDocumentInput } from "@/validators/media";

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts.

// ---------------------------------------------------------------------------
// Before/after gallery
// ---------------------------------------------------------------------------

export type AlbumSummary = {
  jobId: string;
  jobNumber: string;
  customer: { id: string; name: string };
  property: { id: string; postcode: string } | null;
  completedAt: Date | null;
  photoCount: number;
  coverUrl: string | null;
};

export async function listAlbums(customerId?: string, query?: string): Promise<AlbumSummary[]> {
  const jobs = await db.job.findMany({
    where: {
      organisationId: ORG_ID,
      files: { some: { kind: { in: ["PHOTO", "VIDEO"] } } },
      ...(customerId ? { customerId } : {}),
      ...(query
        ? {
            OR: [
              { jobNumber: { contains: query, mode: "insensitive" as const } },
              { customer: { name: { contains: query, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      property: { select: { id: true, postcode: true } },
      files: { where: { kind: { in: ["PHOTO", "VIDEO"] } }, select: { url: true, category: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((job) => {
    const after = job.files.find((f) => f.category === "AFTER");
    const before = job.files.find((f) => f.category === "BEFORE");
    return {
      jobId: job.id,
      jobNumber: job.jobNumber,
      customer: job.customer,
      property: job.property,
      completedAt: job.actualEnd,
      photoCount: job.files.length,
      coverUrl: after?.url ?? before?.url ?? job.files[0]?.url ?? null,
    };
  });
}

export type AlbumPhoto = {
  id: string;
  kind: string;
  category: string | null;
  url: string;
  thumbnailUrl: string | null;
  pairedWithId: string | null;
  sharedToPortal: boolean;
  createdAt: Date;
};

export type AlbumDetail = {
  jobId: string;
  jobNumber: string;
  customer: { id: string; name: string };
  property: { id: string; addressLine1: string; postcode: string } | null;
  completedAt: Date | null;
  photos: AlbumPhoto[];
};

export async function getAlbum(jobId: string): Promise<AlbumDetail | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, organisationId: ORG_ID },
    include: {
      customer: { select: { id: true, name: true } },
      property: { select: { id: true, addressLine1: true, postcode: true } },
      files: {
        where: { kind: { in: ["PHOTO", "VIDEO"] } },
        select: { id: true, kind: true, category: true, url: true, thumbnailUrl: true, pairedWithId: true, sharedToPortal: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!job) return null;

  return {
    jobId: job.id,
    jobNumber: job.jobNumber,
    customer: job.customer,
    property: job.property,
    completedAt: job.actualEnd,
    photos: job.files as AlbumPhoto[],
  };
}

/** Pairs two photos both ways so the before/after slider knows which two to compare. */
export async function pairPhotos(photoId: string, pairWithId: string): Promise<void> {
  if (photoId === pairWithId) throw new Error("Choose two different photos to pair.");
  await db.$transaction([
    db.mediaFile.update({ where: { id: photoId }, data: { pairedWithId: pairWithId } }),
    db.mediaFile.update({ where: { id: pairWithId }, data: { pairedWithId: photoId } }),
  ]);
}

export async function unpairPhoto(photoId: string): Promise<void> {
  const photo = await db.mediaFile.findUnique({ where: { id: photoId }, select: { pairedWithId: true } });
  const ops = [db.mediaFile.update({ where: { id: photoId }, data: { pairedWithId: null } })];
  if (photo?.pairedWithId) {
    ops.push(db.mediaFile.update({ where: { id: photo.pairedWithId }, data: { pairedWithId: null } }));
  }
  await db.$transaction(ops);
}

/** Shares (or unshares) a before/after pair to the customer portal together — the
 * slider needs both sides, so this always toggles both MediaFile rows as one unit. */
export async function setPairSharedToPortal(beforeId: string, afterId: string, shared: boolean): Promise<void> {
  await db.$transaction([
    db.mediaFile.update({ where: { id: beforeId }, data: { sharedToPortal: shared } }),
    db.mediaFile.update({ where: { id: afterId }, data: { sharedToPortal: shared } }),
  ]);
}

// ---------------------------------------------------------------------------
// Document vault — merges actually-uploaded MediaFile DOCUMENT rows with the
// quote / invoice / warranty PDFs that already exist as generated documents,
// so nothing needs to be re-uploaded to appear here.
// ---------------------------------------------------------------------------

export type DocumentItem = {
  id: string;
  category: string;
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
  customer: { id: string; name: string } | null;
  job: { id: string; jobNumber: string } | null;
};

function documentNameFromUrl(url: string): string {
  if (url.startsWith("data:")) return "Uploaded document";
  const clean = url.split("?")[0];
  const last = clean.substring(clean.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(last) || "Document";
  } catch {
    return last || "Document";
  }
}

export async function listDocuments(
  filters: { customerId?: string; jobId?: string; category?: string; query?: string } = {}
): Promise<DocumentItem[]> {
  const { customerId, jobId, category, query } = filters;

  const [quotes, invoices, warranties, uploads] = await Promise.all([
    db.quote.findMany({
      where: {
        organisationId: ORG_ID,
        ...(customerId ? { customerId } : {}),
        ...(jobId ? { job: { id: jobId } } : {}),
      },
      select: {
        id: true,
        quoteNumber: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        job: { select: { id: true, jobNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.invoice.findMany({
      where: {
        customer: { organisationId: ORG_ID },
        ...(customerId ? { customerId } : {}),
        ...(jobId ? { jobId } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        job: { select: { id: true, jobNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.warranty.findMany({
      where: {
        job: { organisationId: ORG_ID, ...(customerId ? { customerId } : {}) },
        ...(jobId ? { jobId } : {}),
      },
      select: {
        id: true,
        startDate: true,
        job: { select: { id: true, jobNumber: true, customer: { select: { id: true, name: true } } } },
      },
      orderBy: { startDate: "desc" },
    }),
    db.mediaFile.findMany({
      where: {
        organisationId: ORG_ID,
        kind: "DOCUMENT",
        ...(customerId ? { customerId } : {}),
        ...(jobId ? { jobId } : {}),
      },
      select: {
        id: true,
        category: true,
        url: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        job: { select: { id: true, jobNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const items: DocumentItem[] = [
    ...quotes.map((q) => ({
      id: `quote-${q.id}`,
      category: "QUOTE_PDF",
      name: `Quote ${q.quoteNumber}.pdf`,
      url: `/api/quotes/${q.id}/pdf`,
      mimeType: "application/pdf",
      sizeBytes: null,
      createdAt: q.createdAt,
      customer: q.customer,
      job: q.job,
    })),
    ...invoices.map((inv) => ({
      id: `invoice-${inv.id}`,
      category: "INVOICE_PDF",
      name: `${inv.invoiceNumber}.pdf`,
      url: `/api/invoices/${inv.id}/pdf`,
      mimeType: "application/pdf",
      sizeBytes: null,
      createdAt: inv.createdAt,
      customer: inv.customer,
      job: inv.job,
    })),
    ...warranties.map((w) => ({
      // Keyed by jobId (not the warranty's own id) so the portal PDF proxy
      // route can look it up via getWarrantyByJobId, which is all that
      // service exposes — see the Milestone 11 note in portal.service.ts.
      id: `warranty-${w.job.id}`,
      category: "CERTIFICATE",
      name: `Warranty ${w.job.jobNumber}.pdf`,
      url: `/api/jobs/${w.job.id}/warranty-pdf`,
      mimeType: "application/pdf",
      sizeBytes: null,
      createdAt: w.startDate,
      customer: w.job.customer,
      job: { id: w.job.id, jobNumber: w.job.jobNumber },
    })),
    ...uploads.map((u) => ({
      id: u.id,
      category: u.category ?? "OTHER",
      name: documentNameFromUrl(u.url),
      url: u.url,
      mimeType: u.mimeType,
      sizeBytes: u.sizeBytes,
      createdAt: u.createdAt,
      customer: u.customer,
      job: u.job,
    })),
  ];

  let filtered = items;
  if (category) filtered = filtered.filter((i) => i.category === category);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.customer?.name.toLowerCase().includes(q) ||
        i.job?.jobNumber.toLowerCase().includes(q)
    );
  }

  return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createDocument(input: UploadDocumentInput): Promise<{ id: string }> {
  const file = await db.mediaFile.create({
    data: {
      organisationId: ORG_ID,
      customerId: input.customerId || null,
      jobId: input.jobId || null,
      kind: "DOCUMENT",
      category: input.category,
      url: input.url,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
  });
  return { id: file.id };
}
