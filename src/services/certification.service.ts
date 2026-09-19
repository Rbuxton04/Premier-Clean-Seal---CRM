import type { CertOwnerType } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { getFileUrl } from "@/lib/storage/supabase";
import type { CertStatus } from "@/validators/certification";
import type { CertificationInput } from "@/validators/certification";

// ---------------------------------------------------------------------------
// Status thresholds -- the single source of truth shared by the
// certifications list page AND the dashboard alerts box (alerts.service.ts
// imports daysUntil/getCertStatus from here), so the two can never disagree
// on what counts as "expiring soon".
// ---------------------------------------------------------------------------

const EXPIRING_SOON_DAYS = 30;
const UPCOMING_DAYS = 60;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole days from now to expiryDate, day-boundary comparison (not raw milliseconds) so "expires today" is always 0 regardless of time-of-day. Negative when already past. */
export function daysUntil(expiryDate: Date, now: Date = new Date()): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((startOfDay(expiryDate).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);
}

/** expired (<0 days), expiring soon (<=30), upcoming (<=60), else valid. */
export function getCertStatus(expiryDate: Date, now: Date = new Date()): CertStatus {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return "EXPIRED";
  if (days <= EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
  if (days <= UPCOMING_DAYS) return "UPCOMING";
  return "VALID";
}

/** Resolves a stored storage path to a viewable signed URL -- same pattern as resolveUrl in media.service.ts. Falls back to the raw path if signing fails, never throws. */
async function resolveFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  return (await getFileUrl(path)) ?? path;
}

// Explicit hand-written return types -- see the Prisma typing note in customer.service.ts.

export type CertificationListItem = {
  id: string;
  name: string;
  category: string;
  ownerType: CertOwnerType;
  user: { id: string; name: string } | null;
  issueDate: Date | null;
  expiryDate: Date;
  reference: string | null;
  fileUrl: string | null;
  notes: string | null;
  status: CertStatus;
  daysUntilExpiry: number;
};

export type CertificationFilters = { category?: string; ownerType?: CertOwnerType; userId?: string; status?: CertStatus };

export async function listCertifications(filters: CertificationFilters = {}): Promise<CertificationListItem[]> {
  const { category, ownerType, userId, status } = filters;

  const rows = await db.certification.findMany({
    where: {
      organisationId: ORG_ID,
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(ownerType ? { ownerType } : {}),
      ...(userId ? { userId } : {}),
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { expiryDate: "asc" },
  });

  const now = new Date();
  const items: CertificationListItem[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      ownerType: r.ownerType,
      user: r.user,
      issueDate: r.issueDate,
      expiryDate: r.expiryDate,
      reference: r.reference,
      fileUrl: await resolveFileUrl(r.fileUrl),
      notes: r.notes,
      status: getCertStatus(r.expiryDate, now),
      daysUntilExpiry: daysUntil(r.expiryDate, now),
    }))
  );

  // status is computed, not a stored column, so it's filtered here rather
  // than in the Prisma where clause -- the certifications table is small
  // (a handful of business/person records), so this is cheap.
  return status ? items.filter((i) => i.status === status) : items;
}

/** Distinct categories actually in use, for the filter dropdown -- category is free text (see the schema comment), so this reflects real data rather than a fixed list. */
export async function listCertificationCategories(): Promise<string[]> {
  const rows = await db.certification.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

export type CertificationDetail = {
  id: string;
  name: string;
  category: string;
  ownerType: CertOwnerType;
  userId: string | null;
  issueDate: Date | null;
  expiryDate: Date;
  reference: string | null;
  fileUrl: string | null;
  notes: string | null;
};

export async function getCertification(id: string): Promise<CertificationDetail | null> {
  const row = await db.certification.findFirst({ where: { id, organisationId: ORG_ID, deletedAt: null } });
  if (!row) return null;
  return { ...row, fileUrl: await resolveFileUrl(row.fileUrl) };
}

export async function createCertification(data: CertificationInput) {
  return db.certification.create({
    data: {
      organisationId: ORG_ID,
      name: data.name,
      category: data.category,
      ownerType: data.ownerType,
      userId: data.ownerType === "PERSON" ? data.userId ?? null : null,
      issueDate: data.issueDate ?? null,
      expiryDate: data.expiryDate,
      reference: data.reference || null,
      fileUrl: data.fileUrl || null,
      notes: data.notes || null,
    },
  });
}

export async function updateCertification(id: string, data: CertificationInput) {
  return db.certification.update({
    where: { id },
    data: {
      name: data.name,
      category: data.category,
      ownerType: data.ownerType,
      userId: data.ownerType === "PERSON" ? data.userId ?? null : null,
      issueDate: data.issueDate ?? null,
      expiryDate: data.expiryDate,
      reference: data.reference || null,
      // Only overwritten when a new file was actually uploaded -- the create
      // form always sends fileUrl (possibly empty), but the edit form must
      // preserve the existing file when the user doesn't replace it. See
      // updateCertificationAction, which omits fileUrl from the payload
      // entirely when no new file was chosen.
      ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl || null } : {}),
      notes: data.notes || null,
    },
  });
}

/**
 * Soft-delete -- mirrors softDeleteCustomer/softDeleteJob. Admin-only and
 * confirmed client-side, matching the brief; enforced with requireAdmin()
 * in the delete action, not here. Never cascades (nothing references a
 * Certification).
 */
export async function softDeleteCertification(id: string, userId: string | null): Promise<void> {
  await db.certification.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId } });
}

export async function restoreCertification(id: string): Promise<void> {
  await db.certification.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
}
