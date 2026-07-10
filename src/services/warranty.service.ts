import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { renderWarrantyPdfBuffer, type WarrantyPdfData } from "@/lib/pdf/warranty-pdf";
import { applicationAreaLabels } from "@/validators/completion";

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts. Warranty has no organisationId of its own, so
// tenancy is scoped through the job relation.
export type WarrantyListItem = {
  id: string;
  startDate: Date;
  endDate: Date;
  coverage: string;
  certificateUrl: string | null;
  job: { id: string; jobNumber: string; customer: { id: string; name: string } };
};

export type WarrantyDetail = {
  id: string;
  startDate: Date;
  endDate: Date;
  coverage: string;
  certificateUrl: string | null;
  job: {
    id: string;
    jobNumber: string;
    customer: { id: string; name: string };
    property: { addressLine1: string; postcode: string } | null;
    materials: Array<{ applicationArea: string; product: { manufacturer: string; name: string; colour: string } }>;
  };
};

export async function listWarranties(query?: string): Promise<WarrantyListItem[]> {
  const rows = await db.warranty.findMany({
    where: {
      job: {
        organisationId: ORG_ID,
        customer: { deletedAt: null },
        ...(query
          ? {
              OR: [
                { jobNumber: { contains: query, mode: "insensitive" as const } },
                { customer: { name: { contains: query, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
    },
    include: { job: { select: { id: true, jobNumber: true, customer: { select: { id: true, name: true } } } } },
    orderBy: { endDate: "desc" },
  });
  return rows as WarrantyListItem[];
}

export async function getWarrantyByJobId(jobId: string): Promise<WarrantyDetail | null> {
  const row = await db.warranty.findFirst({
    where: { jobId },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          customer: { select: { id: true, name: true } },
          property: { select: { addressLine1: true, postcode: true } },
          materials: { select: { applicationArea: true, product: { select: { manufacturer: true, name: true, colour: true } } } },
        },
      },
    },
  });
  return row as WarrantyDetail | null;
}

export async function getWarrantyPdfBuffer(warranty: WarrantyDetail): Promise<Buffer> {
  const data: WarrantyPdfData = {
    jobNumber: warranty.job.jobNumber,
    customerName: warranty.job.customer.name,
    propertyAddress: warranty.job.property ? `${warranty.job.property.addressLine1}, ${warranty.job.property.postcode}` : null,
    startDate: warranty.startDate,
    endDate: warranty.endDate,
    coverage: warranty.coverage,
    materials: warranty.job.materials.map((m) => ({
      productLabel: `${m.product.manufacturer} ${m.product.name}`,
      colour: m.product.colour,
      area: applicationAreaLabels[m.applicationArea as keyof typeof applicationAreaLabels] ?? m.applicationArea,
    })),
  };
  return renderWarrantyPdfBuffer(data);
}
