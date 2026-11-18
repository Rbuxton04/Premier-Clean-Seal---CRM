import { z } from "zod";

// ---------------------------------------------------------------------------
// Scale math -- pure functions, no imports, safe in both server services and
// the client-side measuring tool. See the schema comment on
// Takeoff.pointsPerMetre for the overall approach.
//
// A PDF point is a fixed physical unit: 72 per inch (25.4mm), regardless of
// the PDF's content. pdf.js renders a page at a "scale" (its viewport
// scale) that is exactly pixels-per-point -- scale 1 means 1 CSS pixel per
// point, i.e. 72 DPI. So:
//   - Given a drawing ratio 1:N (1 unit on the printed paper = N of the
//     same unit in real life), 1mm of paper = 72/25.4 points of paper, so
//     1 real metre = (1000/N) mm of paper = (1000/N) * (72/25.4) points of
//     paper. That figure -- points of paper per real metre -- is exactly
//     what pointsPerMetre stores, and it is independent of render zoom.
//   - Given a calibration line of `screenPixels` drawn at render zoom
//     `renderScale` over a feature of known `realMetres`, the same points-
//     per-metre figure is (screenPixels / renderScale) / realMetres --
//     converting the screen measurement back to point-space first.
//   - Converting a stored measurement (points already in point-space) to
//     real metres is just pointsDistance / pointsPerMetre, at any zoom.
// ---------------------------------------------------------------------------

const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;

/**
 * Default £/m rate a new takeoff item starts with -- the "standard"
 * per-metre rate already used elsewhere in the system (the same figure
 * quote.service.ts's buildDraftFromEnquiry falls back to for an AI-prefilled
 * line item), per the brief's "pre-fill from the rate card" requirement.
 * Fully editable per item/per takeoff; this is only ever a starting point,
 * never charged automatically.
 */
export const DEFAULT_ITEM_RATE_PER_METRE_GBP = 8;

/** Points of paper per real metre, from a drawing ratio 1:N. */
export function pointsPerMetreFromRatio(ratioN: number): number {
  return (1000 / ratioN) * (POINTS_PER_INCH / MM_PER_INCH);
}

/** Points of paper per real metre, back-solved from a calibration line drawn on screen. */
export function pointsPerMetreFromCalibration(screenPixels: number, renderScale: number, realMetres: number): number {
  const pointsDistance = screenPixels / renderScale;
  return pointsDistance / realMetres;
}

/** A screen-pixel distance (at the given render zoom) converted to point-space -- what gets stored for a measurement point. */
export function screenPixelsToPoints(pixels: number, renderScale: number): number {
  return pixels / renderScale;
}

export type Point = { x: number; y: number };

/** Straight-line distance between two points, in whatever space they're already in (point-space, once stored). */
function segmentLength(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Sum of every segment in a chain (2 points = a single length, matching LENGTH measurements too). */
export function chainLengthPoints(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += segmentLength(points[i - 1], points[i]);
  return total;
}

/** A point-space distance converted to real metres for this takeoff's scale, rounded to 2dp -- metres are always shown/stored to 2dp, matching the brief (approximate by design). */
export function pointsToMetres(pointsDistance: number, pointsPerMetre: number): number {
  return +(pointsDistance / pointsPerMetre).toFixed(2);
}

export function computeMeasurementMetres(points: Point[], pointsPerMetre: number): number {
  return pointsToMetres(chainLengthPoints(points), pointsPerMetre);
}

// ---------------------------------------------------------------------------
// Colours -- a starter palette for new items; the colour picker also always
// allows any custom hex via a native <input type="color">, since items are
// often named after a real sealant colour the user wants to match visually.
// ---------------------------------------------------------------------------

export const takeoffItemColourPalette = [
  "#3C2263", // brand plum
  "#B91C1C", // red
  "#B45309", // amber
  "#15803D", // green
  "#0E7490", // teal
  "#1D4ED8", // blue
  "#7E22CE", // purple
  "#BE185D", // pink
  "#374151", // slate/anthracite
  "#CA8A04", // gold
] as const;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const takeoffMeasurementTypes = ["LENGTH", "CHAIN"] as const;

export const pointSchema = z.object({ x: z.number(), y: z.number() });

export const takeoffScaleSchema = z
  .object({
    // Exactly one of these must be provided -- a preset/custom ratio, or a
    // calibration measurement (screen pixels + render scale + real metres).
    ratio: z.coerce.number().positive().optional(),
    label: z.string().optional(),
    calibration: z
      .object({
        screenPixels: z.number().positive(),
        renderScale: z.number().positive(),
        realMetres: z.number().positive(),
      })
      .optional(),
  })
  .refine((v) => v.ratio != null || v.calibration != null, { message: "Set a scale ratio or draw a calibration line." });
export type TakeoffScaleInput = z.infer<typeof takeoffScaleSchema>;

export function resolvePointsPerMetre(input: TakeoffScaleInput): { pointsPerMetre: number; scaleRatioLabel: string | null } {
  if (input.ratio != null) {
    return { pointsPerMetre: pointsPerMetreFromRatio(input.ratio), scaleRatioLabel: input.label ?? `1:${input.ratio}` };
  }
  const c = input.calibration!;
  return { pointsPerMetre: pointsPerMetreFromCalibration(c.screenPixels, c.renderScale, c.realMetres), scaleRatioLabel: null };
}

export const takeoffCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  pdfFileUrl: z.string().min(1),
  pageCount: z.coerce.number().int().positive().optional(),
  customerId: z.string().optional(),
  jobId: z.string().optional(),
  quoteId: z.string().optional(),
  scale: takeoffScaleSchema,
});
export type TakeoffCreateInput = z.infer<typeof takeoffCreateSchema>;

export const takeoffItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  colour: z.string().min(1),
  pricePerMetre: z.coerce.number().nonnegative(),
  sortOrder: z.coerce.number().int().default(0),
});
export type TakeoffItemInput = z.infer<typeof takeoffItemSchema>;

export const takeoffMeasurementSchema = z.object({
  takeoffItemId: z.string().min(1),
  pageNumber: z.coerce.number().int().positive(),
  type: z.enum(takeoffMeasurementTypes),
  points: z.array(pointSchema).min(2, "A measurement needs at least two points"),
  label: z.string().optional(),
});
export type TakeoffMeasurementInput = z.infer<typeof takeoffMeasurementSchema>;

export const scalePresetSchema = z.object({
  label: z.string().min(1, "Label is required"),
  ratio: z.coerce.number().int().positive(),
});
export type ScalePresetInput = z.infer<typeof scalePresetSchema>;
