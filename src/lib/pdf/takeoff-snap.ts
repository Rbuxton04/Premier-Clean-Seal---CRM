// Snap-to-geometry (Drawings Part 2, section 1) -- a plain grid spatial
// index over a page's extracted line segments (takeoff-vector-
// extraction.ts), and the endpoint -> intersection -> nearest-point-on-
// line priority search the brief asks for. Pure, no DOM/pdf.js
// dependency, so it's unit-testable on its own (see
// scripts/check-takeoff-snap.mjs) independent of real PDF content.

import type { Point, Segment } from "./takeoff-vector-extraction";

export type SpatialIndex = { cellSize: number; cells: Map<string, Segment[]> };

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/**
 * Buckets segments into a grid so a lookup near one point only has to
 * check the handful of segments near it, not all of them -- the brief's
 * "stays fast on dense architectural sheets (tens of thousands of
 * segments)" requirement. cellSize should be roughly the snap radius, so
 * a query only ever touches a 3x3 block of cells.
 */
export function buildSpatialIndex(segments: Segment[], cellSize: number): SpatialIndex {
  const cells = new Map<string, Segment[]>();
  for (const s of segments) {
    const minCx = Math.floor(Math.min(s.a.x, s.b.x) / cellSize);
    const maxCx = Math.floor(Math.max(s.a.x, s.b.x) / cellSize);
    const minCy = Math.floor(Math.min(s.a.y, s.b.y) / cellSize);
    const maxCy = Math.floor(Math.max(s.a.y, s.b.y) / cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = cellKey(cx, cy);
        const list = cells.get(key);
        if (list) list.push(s);
        else cells.set(key, [s]);
      }
    }
  }
  return { cellSize, cells };
}

export function querySegmentsNear(index: SpatialIndex, point: Point, radius: number): Segment[] {
  const minCx = Math.floor((point.x - radius) / index.cellSize);
  const maxCx = Math.floor((point.x + radius) / index.cellSize);
  const minCy = Math.floor((point.y - radius) / index.cellSize);
  const maxCy = Math.floor((point.y + radius) / index.cellSize);
  const found = new Set<Segment>();
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const list = index.cells.get(cellKey(cx, cy));
      if (list) for (const s of list) found.add(s);
    }
  }
  return Array.from(found);
}

function closestPointOnSegment(p: Point, s: Segment): Point {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-9) return s.a;
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / lengthSq));
  return { x: s.a.x + t * dx, y: s.a.y + t * dy };
}

/** Standard segment-segment intersection (parametric form); null if parallel or the crossing point falls outside either segment. */
function segmentIntersection(s1: Segment, s2: Segment): Point | null {
  const d1x = s1.b.x - s1.a.x;
  const d1y = s1.b.y - s1.a.y;
  const d2x = s2.b.x - s2.a.x;
  const d2y = s2.b.y - s2.a.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((s2.a.x - s1.a.x) * d2y - (s2.a.y - s1.a.y) * d2x) / denom;
  const u = ((s2.a.x - s1.a.x) * d1y - (s2.a.y - s1.a.y) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: s1.a.x + t * d1x, y: s1.a.y + t * d1y };
}

export type SnapResult = { point: Point; type: "endpoint" | "intersection" | "line" };

/**
 * Searches in priority order -- endpoint, then intersection, then nearest
 * point on a line -- each only considered if it falls within `radius` of
 * `point` (both in the same space the index was built in; the caller
 * converts a screen-pixel radius to that space first).
 */
export function findSnap(point: Point, index: SpatialIndex, radius: number): SnapResult | null {
  const nearby = querySegmentsNear(index, point, radius);
  if (nearby.length === 0) return null;

  let bestEndpoint: SnapResult | null = null;
  let bestEndpointDist = Infinity;
  for (const s of nearby) {
    for (const ep of [s.a, s.b]) {
      const d = Math.hypot(ep.x - point.x, ep.y - point.y);
      if (d <= radius && d < bestEndpointDist) {
        bestEndpointDist = d;
        bestEndpoint = { point: ep, type: "endpoint" };
      }
    }
  }
  if (bestEndpoint) return bestEndpoint;

  let bestIntersection: SnapResult | null = null;
  let bestIntersectionDist = Infinity;
  for (let i = 0; i < nearby.length; i++) {
    for (let j = i + 1; j < nearby.length; j++) {
      const ix = segmentIntersection(nearby[i], nearby[j]);
      if (!ix) continue;
      const d = Math.hypot(ix.x - point.x, ix.y - point.y);
      if (d <= radius && d < bestIntersectionDist) {
        bestIntersectionDist = d;
        bestIntersection = { point: ix, type: "intersection" };
      }
    }
  }
  if (bestIntersection) return bestIntersection;

  let bestOnLine: SnapResult | null = null;
  let bestOnLineDist = Infinity;
  for (const s of nearby) {
    const p = closestPointOnSegment(point, s);
    const d = Math.hypot(p.x - point.x, p.y - point.y);
    if (d <= radius && d < bestOnLineDist) {
      bestOnLineDist = d;
      bestOnLine = { point: p, type: "line" };
    }
  }
  return bestOnLine;
}
