"use server";

import { getCurrentUser } from "@/lib/auth";
import { requireAdmin, hasRole, hasAnyRole } from "@/lib/permissions";
import { planDayInputSchema, geocodeAddressInputSchema, setHomeAddressInputSchema } from "@/validators/route";
import { planRoute, type PlanRouteResult } from "@/services/route.service";
import { geocodeAddress, type GeocodeResult } from "@/services/geocode.service";
import { regeocodeBadProperties, type RegeocodeSummary } from "@/services/map.service";
import { setTechnicianHomeAddress } from "@/services/user.service";

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

  // A pure TECHNICIAN (no ADMIN/OFFICE role too) can only plan their own day.
  if (hasRole(user, "TECHNICIAN") && !hasAnyRole(user, ["ADMIN", "OFFICE"])) {
    if (parsed.data.technicianId !== user.id) return { ok: false, message: "You can only plan your own day." };
  } else if (!hasAnyRole(user, ["ADMIN", "OFFICE"])) {
    return { ok: false, message: "You do not have permission to plan routes." };
  }

  return planRoute({
    technicianId: parsed.data.technicianId,
    dateISO: parsed.data.dateISO,
    origin: parsed.data.origin,
    originSource: parsed.data.originSource ?? null,
    finishMode: parsed.data.finishMode,
    customFinishAddress: parsed.data.customFinishAddress ?? null,
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

/**
 * Admin-only "fix pin locations": re-geocodes every property in the org
 * with missing coordinates or coordinates outside Great Britain (the
 * signature of a bad match from before the proximity/bbox geocoding fix).
 */
export async function regeocodeBadPropertiesAction(): Promise<RegeocodeSummary> {
  await requireAdmin();
  return regeocodeBadProperties();
}

export type SetHomeAddressResult = { ok: boolean; message: string; address?: string | null };

/**
 * Sets (or clears, on an empty address) a technician's saved "finish at
 * home" address for the route planner. A technician can only set their own;
 * admin/office can set anyone's — same office-roles gate as planMyDayAction.
 * Geocoded here, GB-constrained, before saving, so a bad address is never
 * cached as a home location.
 */
export async function setTechnicianHomeAddressAction(input: unknown): Promise<SetHomeAddressResult> {
  const parsed = setHomeAddressInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in." };

  // A pure TECHNICIAN (no ADMIN/OFFICE role too) can only edit their own home address.
  if (hasRole(user, "TECHNICIAN") && !hasAnyRole(user, ["ADMIN", "OFFICE"])) {
    if (parsed.data.technicianId !== user.id) return { ok: false, message: "You can only edit your own home address." };
  } else if (!hasAnyRole(user, ["ADMIN", "OFFICE"])) {
    return { ok: false, message: "You do not have permission to edit this." };
  }

  const address = parsed.data.address.trim();
  if (address.length === 0) {
    await setTechnicianHomeAddress(parsed.data.technicianId, null, null, null);
    return { ok: true, message: "Home address cleared.", address: null };
  }

  const geocoded = await geocodeAddress(address);
  if (!geocoded) {
    return { ok: false, message: "Couldn't locate that address — check it and try again." };
  }

  await setTechnicianHomeAddress(parsed.data.technicianId, address, geocoded.latitude, geocoded.longitude);
  return { ok: true, message: "Home address saved.", address };
}
