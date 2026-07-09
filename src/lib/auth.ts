import { currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Auth helper. Clerk is used when keys are present; otherwise the app runs
 * in OPEN DEV MODE so you can explore the UI before creating a Clerk account.
 */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// role is the legacy single-role column, kept only for display/back-compat.
// roles is the source of truth for every permission check -- see
// hasRole()/hasAnyRole() in src/lib/permissions.ts.
export type CurrentUser = { id: string; clerkId: string | null; name: string; email: string; role: Role; roles: Role[]; active: boolean };

// Dev mode has no real staff records, so every action is attributed to a
// synthetic ADMIN who is also a TECHNICIAN (mirrors the real owner account's
// roles — see prisma/seed.ts) — this is fine locally but must never happen
// once Clerk keys are set in production (clerkEnabled gates that).
const DEV_USER: CurrentUser = {
  id: "dev-admin",
  clerkId: null,
  name: "Dev Admin (open mode)",
  email: "dev@local",
  role: "ADMIN",
  roles: ["ADMIN", "TECHNICIAN"],
  active: true,
};

/** Resolves the signed-in staff member, or null if unauthenticated / deactivated / not yet synced. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!clerkEnabled) return DEV_USER;

  const clerkUser = await clerkCurrentUser();
  if (!clerkUser) return null;

  let user = await db.user.findUnique({ where: { clerkId: clerkUser.id } });

  // The Clerk webhook (/api/webhooks/clerk) is what normally links clerkId
  // to a User row, but it requires a one-time endpoint setup in the Clerk
  // dashboard — until that's done (or if the event is simply still in
  // flight), fall back to matching on primary email and link it here so
  // sign-in doesn't have a silent dependency on the webhook being wired up.
  if (!user) {
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress;
    if (email) {
      const byEmail = await db.user.findUnique({ where: { email } });
      if (byEmail && !byEmail.clerkId) {
        user = await db.user.update({ where: { id: byEmail.id }, data: { clerkId: clerkUser.id } });
      }
    }
  }

  if (!user || !user.active) return null;

  // Defensive fallback for a row that somehow predates the roles[] backfill
  // (should never happen -- seed and every writer keep the two in sync).
  const roles = user.roles.length > 0 ? user.roles : [user.role];

  return { id: user.id, clerkId: user.clerkId, name: user.name, email: user.email, role: user.role, roles, active: user.active };
}
