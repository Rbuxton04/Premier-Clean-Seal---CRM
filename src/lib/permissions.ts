import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

export type Action = "read" | "create" | "update" | "delete";

export type Resource =
  | "customers"
  | "quotes"
  | "jobs"
  | "invoices"
  | "financials"
  | "materials"
  | "marketing"
  | "gallery"
  | "documents"
  | "insights"
  | "search"
  | "portal"
  | "settings"
  | "staff"
  | "audit"
  | "gdpr"
  | "backups";

/**
 * Sensible defaults baked into code, per the M12 brief — ADMIN always has
 * every permission (checked first, before any table lookup). These defaults
 * are also what gets seeded into the Permission table so the (currently
 * read-only) admin view has something real to show; if an org customises a
 * row in that table, the DB row wins over the hardcoded default below.
 */
export const DEFAULT_PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  ADMIN: {}, // short-circuited in can() — ADMIN can do everything
  OFFICE: {
    customers: ["read", "create", "update", "delete"],
    quotes: ["read", "create", "update", "delete"],
    jobs: ["read", "create", "update", "delete"],
    invoices: ["read", "create", "update"],
    financials: ["read"],
    materials: ["read", "create", "update", "delete"],
    marketing: ["read", "create", "update", "delete"],
    gallery: ["read", "create", "update", "delete"],
    documents: ["read", "create", "update", "delete"],
    insights: ["read"],
    search: ["read"],
    portal: ["read", "create", "update"],
  },
  ESTIMATOR: {
    customers: ["read", "create", "update"],
    quotes: ["read", "create", "update"],
    jobs: ["read"],
    financials: ["read"],
    materials: ["read"],
    gallery: ["read", "create"],
    documents: ["read"],
    search: ["read"],
  },
  SALES: {
    customers: ["read", "create", "update"],
    quotes: ["read", "create"],
    jobs: ["read"],
    marketing: ["read", "create", "update"],
    search: ["read"],
    portal: ["read", "create"],
  },
  TECHNICIAN: {
    jobs: ["read", "update"], // scoped to assigned jobs only — enforced in job.service/page, not here
    gallery: ["read", "create"],
    documents: ["read"],
  },
  READONLY: {
    customers: ["read"],
    quotes: ["read"],
    jobs: ["read"],
    invoices: ["read"],
    financials: ["read"],
    materials: ["read"],
    marketing: ["read"],
    gallery: ["read"],
    documents: ["read"],
    insights: ["read"],
    search: ["read"],
    portal: ["read"],
  },
};

const FINANCIAL_ROLES: Role[] = ["ADMIN", "OFFICE"];

/** Whether a role should see money figures (cost, margin, deposits, balances) at all. */
export function canViewFinancials(role: Role): boolean {
  return FINANCIAL_ROLES.includes(role);
}

/**
 * Checks a role's permission for a resource/action, reading any org-level
 * override from the Permission table first and falling back to the
 * hardcoded defaults above. ADMIN is always allowed everything.
 */
export async function can(role: Role, resource: Resource, action: Action): Promise<boolean> {
  if (role === "ADMIN") return true;

  const override = await db.permission.findUnique({
    where: { organisationId_role_resource: { organisationId: ORG_ID, role, resource } },
  });
  const allowed = override?.actions ?? DEFAULT_PERMISSIONS[role]?.[resource] ?? [];
  return allowed.includes(action);
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Server-side guard for actions/pages. Throws ForbiddenError (never trusts a
 * client-side check) when the signed-in user is missing, deactivated, or
 * lacks the requested permission. Returns the resolved user on success so
 * callers can use it (e.g. to stamp AuditLog.userId).
 */
export async function requirePermission(resource: Resource, action: Action): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Please sign in.");
  if (!(await can(user.role, resource, action))) throw new ForbiddenError(`Your role (${user.role}) cannot ${action} ${resource}.`);
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Please sign in.");
  if (user.role !== "ADMIN") throw new ForbiddenError("This action is restricted to administrators.");
  return user;
}
