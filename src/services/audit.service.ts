import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts.
export type AuditLogItem = {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: Date;
  user: { id: string; name: string } | null;
};

export type AuditLogFilters = { userId?: string; resource?: string; from?: Date; to?: Date };

export async function listAuditLogs(filters: AuditLogFilters = {}, take = 100): Promise<AuditLogItem[]> {
  const rows = await db.auditLog.findMany({
    where: {
      organisationId: ORG_ID,
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.resource ? { resource: filters.resource } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id))));
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => ({ ...r, user: r.userId ? userById.get(r.userId) ?? null : null }));
}

export async function listAuditResources(): Promise<string[]> {
  const rows = await db.auditLog.findMany({
    where: { organisationId: ORG_ID },
    select: { resource: true },
    distinct: ["resource"],
    orderBy: { resource: "asc" },
  });
  return rows.map((r) => r.resource);
}
