// Extracts straight-line segments from a PDF page's vector content, for
// Drawings Part 2 section 1's snap-to-geometry feature. Operates on an
// already-fetched pdf.js operator list ({ fnArray, argsArray }) -- the
// caller is responsible for getting one via page.getOperatorList() -- so
// this module only needs pdf.js's OPS constant, not pdf.js itself.
//
// pdf.js 4.x consolidates path construction into one OPS.constructPath
// operator per subpath-group rather than separate moveTo/lineTo ops; its
// args are [subOps: number[], coords: number[], minMax: number[]], where
// each subOp consumes a fixed number of (x, y) pairs from the flat coords
// array (verified against a real generated PDF, not assumed from docs --
// see scripts/check-takeoff-vector-extraction.mjs): moveTo/lineTo consume
// 1 point, curveTo consumes 3, curveTo2/curveTo3 consume 2, rectangle
// consumes 2 (x, y, width, height), closePath consumes 0.
//
// Those coordinates are in the path's LOCAL space and must go through the
// accumulated current transformation matrix (CTM) -- built up by replaying
// every save/restore/transform operator in the same operator list -- to
// land in the page's actual point space. Curves are approximated by the
// straight chord from their start to end point (good enough for snapping
// to a curve's endpoints; not for snapping to a point partway along it --
// a disclosed simplification, not an oversight).

export type Point = { x: number; y: number };
export type Segment = { a: Point; b: Point };

/** [a, b, c, d, e, f] -- the standard 2D affine matrix convention PDF/canvas both use: x' = a*x + c*y + e; y' = b*x + d*y + f. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

/** Combines m1 (applied first, local) with m2 (the CTM so far) -- a point transforms as `applyMatrix(combine(m1, m2), point)`, equivalent to applying m1 then m2. */
export function combineMatrices(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

export function applyMatrix(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

// Mirrors pdfjs-dist's OPS constant values for just the ops this cares
// about -- kept as plain numbers (not imported from pdfjs-dist) so this
// module has zero runtime dependency on it and can be unit-tested with a
// synthetic operator list with no pdf.js involved at all.
export const PATH_OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  constructPath: 91,
} as const;

/**
 * Walks one constructPath operator's args and returns the straight-line
 * segments it implies, already transformed by `ctm`.
 */
function extractSegmentsFromPath(subOps: number[], coords: number[], ctm: Matrix): Segment[] {
  const segments: Segment[] = [];
  let coordIndex = 0;
  let current: Point | null = null;
  let subpathStart: Point | null = null;

  function nextPoint(): Point {
    const local = { x: coords[coordIndex], y: coords[coordIndex + 1] };
    coordIndex += 2;
    return applyMatrix(ctm, local);
  }

  for (const op of subOps) {
    if (op === PATH_OPS.moveTo) {
      current = nextPoint();
      subpathStart = current;
    } else if (op === PATH_OPS.lineTo) {
      const next = nextPoint();
      if (current) segments.push({ a: current, b: next });
      current = next;
    } else if (op === PATH_OPS.curveTo) {
      coordIndex += 4; // two control points, unused -- see the chord-approximation note above
      const end = nextPoint();
      if (current) segments.push({ a: current, b: end });
      current = end;
    } else if (op === PATH_OPS.curveTo2 || op === PATH_OPS.curveTo3) {
      coordIndex += 2; // one control point, unused
      const end = nextPoint();
      if (current) segments.push({ a: current, b: end });
      current = end;
    } else if (op === PATH_OPS.rectangle) {
      const origin = nextPoint();
      const wh = { x: coords[coordIndex], y: coords[coordIndex + 1] };
      coordIndex += 2;
      const corners = [
        origin,
        applyMatrix(ctm, { x: coords[coordIndex - 4] + wh.x, y: coords[coordIndex - 3] }),
        applyMatrix(ctm, { x: coords[coordIndex - 4] + wh.x, y: coords[coordIndex - 3] + wh.y }),
        applyMatrix(ctm, { x: coords[coordIndex - 4], y: coords[coordIndex - 3] + wh.y }),
      ];
      for (let i = 0; i < 4; i++) segments.push({ a: corners[i], b: corners[(i + 1) % 4] });
      current = origin;
      subpathStart = origin;
    } else if (op === PATH_OPS.closePath) {
      if (current && subpathStart) segments.push({ a: current, b: subpathStart });
    }
  }
  return segments;
}

/**
 * The main entry point: replays an operator list's save/restore/transform/
 * constructPath operators to produce every straight-line segment on the
 * page, in final page-point space. Caps replay at `maxOps` operators as a
 * defensive time-bound for a pathologically complex page (the brief's
 * "cap extraction time... degrade" requirement) -- returns whatever was
 * extracted before the cap, plus whether it was actually hit.
 */
export function extractLineSegments(
  fnArray: number[],
  argsArray: unknown[][],
  maxOps = 200_000
): { segments: Segment[]; capped: boolean } {
  const segments: Segment[] = [];
  const ctmStack: Matrix[] = [];
  let ctm: Matrix = IDENTITY_MATRIX;
  let capped = false;

  const limit = Math.min(fnArray.length, maxOps);
  capped = fnArray.length > maxOps;

  for (let i = 0; i < limit; i++) {
    const op = fnArray[i];
    if (op === PATH_OPS.save) {
      ctmStack.push(ctm);
    } else if (op === PATH_OPS.restore) {
      ctm = ctmStack.pop() ?? IDENTITY_MATRIX;
    } else if (op === PATH_OPS.transform) {
      const m = argsArray[i] as Matrix;
      ctm = combineMatrices(m, ctm);
    } else if (op === PATH_OPS.constructPath) {
      const [subOps, coords] = argsArray[i] as [number[], number[], number[]];
      segments.push(...extractSegmentsFromPath(subOps, coords, ctm));
    }
  }
  return { segments, capped };
}
