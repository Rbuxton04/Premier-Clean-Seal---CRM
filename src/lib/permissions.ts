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
  | "backups"
  | "finance";

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
    finance: ["read"],
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
  // Read-only and finance-scoped: no entry for any other resource, so
  // every other can() check (customers, jobs, quotes, marketing, staff,
  // settings, etc.) correctly returns false via the `?? []` fallback below.
  ACCOUNTANT: {
    finance: ["read"],
  },
};

const FINANCIAL_ROLES: Role[] = ["ADMIN", "OFFICE"];

/** Whether ANY of a user's roles should see money figures (cost, margin, deposits, balances) — additive, most-permissive wins. */
export function canViewFinancials(roles: Role[]): boolean {
  return roles.some((role) => FINANCIAL_ROLES.includes(role));
}

/**
 * Checks whether ANY of a user's roles grants a resource/action, reading any
 * org-level override from the Permission table first and falling back to the
 * hardcoded defaults above. Roles are additive — most-permissive wins. ADMIN
 * (in any position) is always allowed everything.
 */
export async function can(roles: Role[], resource: Resource, action: Action): Promise<boolean> {
  if (roles.includes("ADMIN")) return true;

  for (const role of roles) {
    const override = await db.permission.findUnique({
      where: { organisationId_role_resource: { organisationId: ORG_ID, role, resource } },
    });
    const allowed = override?.actions ?? DEFAULT_PERMISSIONS[role]?.[resource] ?? [];
    if (allowed.includes(action)) return true;
  }
  return false;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Whether a user holds a given role — the additive-roles building block every other check is written in terms of. Null-safe. */
export function hasRole(user: CurrentUser | null | undefined, role: Role): boolean {
  return Boolean(user?.roles.includes(role));
}

/** Whether a user holds ANY of the given roles. Null-safe. */
export function hasAnyRole(user: CurrentUser | null | undefined, roles: Role[]): boolean {
  return Boolean(user && user.roles.some((r) => roles.includes(r)));
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
  if (!(await can(user.roles, resource, action))) throw new ForbiddenError(`Your roles (${user.roles.join(", ")}) cannot ${action} ${resource}.`);
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Please sign in.");
  if (!user.roles.includes("ADMIN")) throw new ForbiddenError("This action is restricted to administrators.");
  return user;
}

/**
 * Read gate for the Finance area (ADMIN/OFFICE/ACCOUNTANT by default, or an
 * org override in the Permission table) — used by every page under
 * src/app/(crm)/finance/ so direct navigation to a finance URL is re-checked
 * server-side regardless of the (crm) layout's ACCOUNTANT route redirect.
 */
export async function canViewFinance(roles: Role[] | null | undefined): Promise<boolean> {
  if (!roles || roles.length === 0) return false;
  return can(roles, "finance", "read");
}
