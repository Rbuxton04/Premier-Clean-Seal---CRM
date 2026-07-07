"use server";

import { getCurrentUser } from "@/lib/auth";
import { planDayInputSchema, geocodeAddressInputSchema } from "@/validators/route";
import { planRoute, type PlanRouteResult } from "@/services/route.service";
import { geocodeAddress, type GeocodeResult } from "@/services/geocode.service";

/**
 * "Plan my day" is available to the office (any technician) and to a
 * technician planning their own day — never a technician planning someone
 * else's, and never a role with no jobs/scheduling remit at all. Enforced
 * here server-side; the client never gets to assert who it's planning for.
 */
export async function planMyDayAction(input: unknown): Promise<PlanRouteResult> {
  const parsed = planDayInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };

  const officeRoles = ["ADMIN", "OFFICE"];
  if (user.role === "TECHNICIAN") {
    if (parsed.data.technicianId !== user.id) return { ok: false, message: "You can only plan your own day." };
  } else if (!officeRoles.includes(user.role)) {
    return { ok: false, message: "You do not have permission to plan routes." };
  }

  return planRoute({
    technicianId: parsed.data.technicianId,
    dateISO: parsed.data.dateISO,
    origin: parsed.data.origin,
    originSource: parsed.data.originSource ?? null,
  });
}

/** Resolves a manually-typed start address (postcode etc.) to coordinates, for the geolocation-denied fallback. */
export async function geocodeOriginAction(input: unknown): Promise<GeocodeResult | null> {
  const parsed = geocodeAddressInputSchema.safeParse(input);
  if (!parsed.success) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  return geocodeAddress(parsed.data.address);
}
