import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";

// Explicit hand-written return types — see the Prisma typing note in
// customer.service.ts.
export type StaffListItem = {
  id: string;
  clerkId: string | null;
  name: string;
  email: string;
  role: Role;
  roles: Role[];
  active: boolean;
  createdAt: Date;
};

export async function listUsers(): Promise<StaffListItem[]> {
  return db.user.findMany({
    where: { organisationId: ORG_ID },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUser(id: string): Promise<StaffListItem | null> {
  return db.user.findFirst({ where: { id, organisationId: ORG_ID } });
}

// Highest-to-lowest privilege, used only to derive the legacy single `role`
// column from `roles[]` on every write -- application logic never reads
// `role` for permission decisions, see hasRole()/hasAnyRole() in
// src/lib/permissions.ts.
const ROLE_PRIORITY: Role[] = ["ADMIN", "OFFICE", "ACCOUNTANT", "ESTIMATOR", "SALES", "TECHNICIAN", "READONLY"];

export function primaryRole(roles: Role[]): Role {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? "READONLY";
}

export async function updateUserRoles(id: string, roles: Role[]): Promise<void> {
  await db.user.update({ where: { id }, data: { roles, role: primaryRole(roles) } });
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  await db.user.update({ where: { id }, data: { active } });
}

export type TechnicianHome = { homeAddress: string | null; homeLatitude: number | null; homeLongitude: number | null };

export async function getTechnicianHome(id: string): Promise<TechnicianHome | null> {
  return db.user.findFirst({
    where: { id, organisationId: ORG_ID },
    select: { homeAddress: true, homeLatitude: true, homeLongitude: true },
  });
}

/** address=null clears the saved home (used when a technician empties the field). latitude/longitude must be geocoded by the caller before saving — never store an address without matching coordinates. */
export async function setTechnicianHomeAddress(
  id: string,
  address: string | null,
  latitude: number | null,
  longitude: number | null
): Promise<void> {
  await db.user.update({ where: { id }, data: { homeAddress: address, homeLatitude: latitude, homeLongitude: longitude } });
}

export type ClerkUserEvent = { clerkId: string; name: string; email: string };

/**
 * Called from the Clerk webhook on user.created/user.updated. New staff
 * default to READONLY until an admin promotes them — safer than defaulting
 * to a role with any mutation rights. Matches by clerkId first, falling back
 * to email so a staff member invited to Clerk before their User row existed
 * (e.g. seeded technicians) gets linked up rather than duplicated.
 *
 * Bootstrap exception: if nobody in the org is an active ADMIN yet, the
 * first brand-new sign-in becomes ADMIN automatically — otherwise the very
 * first real Clerk user would land as READONLY and be unable to reach the
 * ADMIN-only Staff & roles page to promote themselves.
 */
export async function upsertUserFromClerk(event: ClerkUserEvent): Promise<void> {
  const existingByClerkId = await db.user.findUnique({ where: { clerkId: event.clerkId } });
  if (existingByClerkId) {
    await db.user.update({ where: { id: existingByClerkId.id }, data: { name: event.name, email: event.email } });
    return;
  }

  const existingByEmail = await db.user.findUnique({ where: { email: event.email } });
  if (existingByEmail) {
    await db.user.update({ where: { id: existingByEmail.id }, data: { clerkId: event.clerkId, name: event.name } });
    return;
  }

  const adminCount = await db.user.count({ where: { organisationId: ORG_ID, roles: { has: "ADMIN" }, active: true } });
  const role: Role = adminCount === 0 ? "ADMIN" : "READONLY";

  await db.user.create({
    data: { organisationId: ORG_ID, clerkId: event.clerkId, name: event.name, email: event.email, role, roles: [role] },
  });
}

/** Called from the Clerk webhook on user.deleted — deactivate rather than delete, since jobs/enquiries may reference this User. */
export async function deactivateUserByClerkId(clerkId: string): Promise<void> {
  await db.user.updateMany({ where: { clerkId }, data: { active: false } });
}
