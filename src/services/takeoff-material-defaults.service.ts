import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import type { MaterialDefaultsValues } from "@/validators/takeoff";

// Worst-case materials settings (Drawings Part 2, section 6) -- a single
// row per organisation. Used only for the materials list (tubes to buy);
// never affects the customer's quote, which stays on measured metres.

const HARDCODED_DEFAULTS: MaterialDefaultsValues = { jointWidthMm: 15, jointDepthMm: 10, tubeMl: 310, wastePercent: 10 };

/** Falls back to the hardcoded defaults (matching the DB column defaults) if the organisation has never saved its own -- no seed row needed. */
export async function getMaterialDefaults(): Promise<MaterialDefaultsValues> {
  const row = await db.takeoffMaterialDefaults.findUnique({ where: { organisationId: ORG_ID } });
  if (!row) return HARDCODED_DEFAULTS;
  return { jointWidthMm: row.jointWidthMm, jointDepthMm: row.jointDepthMm, tubeMl: row.tubeMl, wastePercent: row.wastePercent };
}

export async function upsertMaterialDefaults(data: MaterialDefaultsValues): Promise<void> {
  await db.takeoffMaterialDefaults.upsert({
    where: { organisationId: ORG_ID },
    create: { organisationId: ORG_ID, ...data },
    update: data,
  });
}
