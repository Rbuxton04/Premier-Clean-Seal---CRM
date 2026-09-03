import { z } from "zod";

export const bathroomTypes = ["FULL_BATH", "SHOWER_ONLY", "BATH_ONLY"] as const;
export const bathroomTypeLabels: Record<(typeof bathroomTypes)[number], string> = {
  FULL_BATH: "Full bath",
  SHOWER_ONLY: "Shower only",
  BATH_ONLY: "Bath only",
};
// Short form for the room grid tile, where space is at a premium.
export const bathroomTypeShortLabels: Record<(typeof bathroomTypes)[number], string> = {
  FULL_BATH: "Bath",
  SHOWER_ONLY: "Shower",
  BATH_ONLY: "Bath only",
};

// NOT_STARTED is the implicit default/cleared state, not a pressable button
// -- see roomStatusButtons below for what actually renders.
export const roomStatuses = ["NOT_STARTED", "SCHEDULED", "DONE", "NO_ACCESS", "SNAG"] as const;
export const roomStatusLabels: Record<(typeof roomStatuses)[number], string> = {
  NOT_STARTED: "Not started",
  SCHEDULED: "Scheduled",
  DONE: "Done",
  NO_ACCESS: "No access",
  SNAG: "Snag",
};
// Tile background/border colour per status -- brand-neutral outside of DONE
// (plum, the brand accent), rather than a generic green, so a completed tile
// reads as "on brand" at a glance across the whole grid.
export const roomStatusTileClass: Record<(typeof roomStatuses)[number], string> = {
  NOT_STARTED: "bg-background border-border text-foreground",
  SCHEDULED: "bg-sky-100 border-sky-300 text-sky-900 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-200",
  DONE: "bg-brand-plum-soft border-brand-plum text-brand-plum dark:bg-brand-plum/30 dark:border-brand-plum-bright dark:text-brand-plum-bright",
  NO_ACCESS: "bg-muted border-border text-muted-foreground",
  SNAG: "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200",
};
// The four pressable status buttons (in the room sheet and the quick-mark
// toolbar) -- NOT_STARTED itself has no button, it's only ever reached by
// pressing the room's current status again to clear it.
export const roomStatusButtons = ["DONE", "SCHEDULED", "NO_ACCESS", "SNAG"] as const satisfies readonly (typeof roomStatuses)[number][];

export const roomVisitWorkTypes = ["CUT_OUT_AND_RESEAL", "NEW_APPLICATION", "GROUT_STEAM", "SNAG_RETURN", "SURVEY"] as const;
export const roomVisitWorkTypeLabels: Record<(typeof roomVisitWorkTypes)[number], string> = {
  CUT_OUT_AND_RESEAL: "Cut out & reseal",
  NEW_APPLICATION: "New application",
  GROUT_STEAM: "Grout steam",
  SNAG_RETURN: "Snag return",
  SURVEY: "Survey",
};

export const roomBulkCreateSchema = z.object({
  floor: z.string().optional(),
  roomNumberRange: z.string().min(1, "Enter at least one room number or range"),
  bathroomType: z.enum(bathroomTypes).default("FULL_BATH"),
});
export type RoomBulkCreateInput = z.infer<typeof roomBulkCreateSchema>;

// A pathologically wide range (e.g. "1-999999999", a likely typo) would
// otherwise try to generate millions of rows -- capped well above any real
// hotel's room count so a typo reports an error instead of hanging the request.
export const MAX_ROOMS_PER_RANGE = 500;

/**
 * Parses the bulk-creation range text -- "101-124", comma lists, and mixed
 * input ("101-110, 112, 114a") -- into a flat, deduplicated list of room
 * numbers, order preserved. Only a plain numeric-to-numeric segment
 * ("101-124") expands as a range; anything else (a single number, a
 * lettered suffix like "114a") is taken as one literal room number, since a
 * lettered range ("12a-15a") has no unambiguous expansion. Expanded numbers
 * are zero-padded to match the wider of the two range endpoints (e.g.
 * "008-012" -> "008".."012"), so a hotel with 3-digit room numbering keeps
 * that width throughout. Throws with a user-facing message if the request
 * would generate more than MAX_ROOMS_PER_RANGE rooms.
 */
export function parseRoomNumberRange(input: string): string[] {
  const segments = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const segment of segments) {
    const rangeMatch = segment.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const [, startStr, endStr] = rangeMatch;
      const start = Math.min(parseInt(startStr, 10), parseInt(endStr, 10));
      const end = Math.max(parseInt(startStr, 10), parseInt(endStr, 10));
      const width = Math.max(startStr.length, endStr.length);
      if (end - start + 1 > MAX_ROOMS_PER_RANGE) {
        throw new Error(`"${segment}" would generate ${end - start + 1} rooms -- the limit per batch is ${MAX_ROOMS_PER_RANGE}.`);
      }
      for (let n = start; n <= end; n++) result.push(String(n).padStart(width, "0"));
    } else {
      result.push(segment);
    }
  }

  if (result.length > MAX_ROOMS_PER_RANGE) {
    throw new Error(`That would generate ${result.length} rooms -- the limit per batch is ${MAX_ROOMS_PER_RANGE}.`);
  }

  // De-dupe while preserving first-seen order (a typo'd overlapping range/
  // literal shouldn't silently double up a room number in the preview).
  return Array.from(new Set(result));
}
