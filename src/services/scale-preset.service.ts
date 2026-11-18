import { db } from "@/lib/db";
import { ORG_ID } from "@/lib/settings";
import type { ScalePresetInput } from "@/validators/takeoff";

// Explicit hand-written return types -- see the Prisma typing note in customer.service.ts.
export type ScalePresetItem = { id: string; label: string; ratio: number };

export async function listScalePresets(): Promise<ScalePresetItem[]> {
  return db.scalePreset.findMany({
    where: { organisationId: ORG_ID },
    select: { id: true, label: true, ratio: true },
    orderBy: { ratio: "asc" },
  });
}

export async function createScalePreset(data: ScalePresetInput): Promise<ScalePresetItem> {
  return db.scalePreset.create({
    data: { organisationId: ORG_ID, label: data.label, ratio: data.ratio },
    select: { id: true, label: true, ratio: true },
  });
}

export async function deleteScalePreset(id: string): Promise<void> {
  await db.scalePreset.delete({ where: { id } });
}
