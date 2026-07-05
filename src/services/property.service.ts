import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import type { WorkLogInput } from "@/validators/work-log";

// Explicit return types so included relations survive across the function
// boundary (see the Prisma typing note in customer.service.ts).
export type WorkLogPhoto = { id: string; url: string; thumbnailUrl: string | null };

export type WorkLogEntry = {
  id: string;
  propertyId: string;
  description: string;
  productId: string | null;
  productText: string;
  colour: string;
  area: string | null;
  batchNumber: string | null;
  completedAt: Date;
  photos: WorkLogPhoto[];
};

export async function addWorkLogEntry(customerId: string, propertyId: string, data: WorkLogInput): Promise<WorkLogEntry> {
  const entry = await db.propertyWorkLog.create({
    data: {
      propertyId,
      description: data.description,
      productId: data.productId || null,
      productText: data.productText,
      colour: data.colour,
      area: data.area,
      batchNumber: data.batchNumber || null,
      completedAt: data.completedAt,
    },
    include: { photos: true },
  });

  const property = await db.property.findUnique({ where: { id: propertyId }, select: { addressLine1: true } });
  await db.timelineEvent.create({
    data: {
      customerId,
      type: "WORK_LOG_ADDED",
      title: `Work logged at ${property?.addressLine1 ?? "property"}: ${data.description} — ${data.colour}`,
    },
  });

  return entry as WorkLogEntry;
}

export async function deleteWorkLogEntry(id: string) {
  return db.propertyWorkLog.delete({ where: { id } });
}

export type ProductOption = { id: string; manufacturer: string; name: string; colour: string };

export async function listProductOptions(): Promise<ProductOption[]> {
  const rows = await db.product.findMany({
    where: { organisationId: ORG_ID },
    select: { id: true, manufacturer: true, name: true, colour: true },
    orderBy: [{ manufacturer: "asc" }, { name: "asc" }, { colour: "asc" }],
  });
  return rows as ProductOption[];
}
