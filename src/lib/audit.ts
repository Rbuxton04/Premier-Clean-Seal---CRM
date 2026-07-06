import { headers } from "next/headers";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";

export type AuditInput = {
  userId?: string | null;
  action: string; // e.g. "CREATE", "UPDATE", "DELETE", "EXPORT", "ERASE"
  resource: string; // e.g. "customer", "quote", "user.role"
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

function toJson(value: unknown) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Central write path for AuditLog so every mutation records the same shape.
 * Never throws — a failed audit write should never block the mutation it's
 * describing (the mutation itself already committed by the time this runs).
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organisationId: ORG_ID,
        userId: input.userId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        before: toJson(input.before),
        after: toJson(input.after),
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}

/** Convenience for server actions: the signed-in staff member + their IP, ready to spread into writeAudit(). */
export async function actorContext(): Promise<{ userId: string | null; ip: string | null }> {
  const user = await getCurrentUser();
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { userId: user?.id ?? null, ip };
}
