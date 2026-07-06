import { currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Auth helper. Clerk is used when keys are present; otherwise the app runs
 * in OPEN DEV MODE so you can explore the UI before creating a Clerk account.
 */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export type CurrentUser = { id: string; clerkId: string | null; name: string; email: string; role: Role; active: boolean };

// Dev mode has no real staff records, so every action is attributed to a
// synthetic ADMIN — this is fine locally but must never happen once Clerk
// keys are set in production (clerkEnabled gates that).
const DEV_USER: CurrentUser = { id: "dev-admin", clerkId: null, name: "Dev Admin (open mode)", email: "dev@local", role: "ADMIN", active: true };

/** Resolves the signed-in staff member, or null if unauthenticated / deactivated / not yet synced. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!clerkEnabled) return DEV_USER;

  const clerkUser = await clerkCurrentUser();
  if (!clerkUser) return null;

  const user = await db.user.findUnique({ where: { clerkId: clerkUser.id } });
  if (!user || !user.active) return null;

  return { id: user.id, clerkId: user.clerkId, name: user.name, email: user.email, role: user.role, active: user.active };
}
