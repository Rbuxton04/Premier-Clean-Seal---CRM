// Standalone test for src/lib/pdf/takeoff-snap.ts -- the spatial index and
// endpoint -> intersection -> on-line priority search behind Drawings
// Part 2 section 1's snapping. Run with: node scripts/check-takeoff-snap.mjs
import { buildSpatialIndex, findSnap, querySegmentsNear } from "../src/lib/pdf/takeoff-snap.ts";

let failed = false;
function check(label, condition, detail) {
  if (condition) console.log(`  OK   ${label}`);
  else {
    failed = true;
    console.log(`  FAIL ${label} -- ${detail}`);
  }
}
function close(a, b, tol = 0.5) {
  return Math.abs(a - b) <= tol;
}

// A simple cross: a horizontal segment and a vertical segment crossing at (100, 100).
const segments = [
  { a: { x: 0, y: 100 }, b: { x: 200, y: 100 } },
  { a: { x: 100, y: 0 }, b: { x: 100, y: 200 } },
];
const index = buildSpatialIndex(segments, 20);

// Priority 1: clicking right next to the horizontal segment's own endpoint should snap to that endpoint, not the line.
{
  const result = findSnap({ x: 2, y: 101 }, index, 10);
  check("near an endpoint snaps to the endpoint, not the line", result?.type === "endpoint" && close(result.point.x, 0) && close(result.point.y, 100), JSON.stringify(result));
}

// Priority 2: clicking near the crossing point (away from either segment's own endpoints) snaps to the intersection.
{
  const result = findSnap({ x: 98, y: 97 }, index, 10);
  check("near the crossing point snaps to the intersection", result?.type === "intersection" && close(result.point.x, 100) && close(result.point.y, 100), JSON.stringify(result));
}

// Priority 3: clicking near the middle of a segment, away from any endpoint or intersection, snaps onto the line.
{
  const result = findSnap({ x: 50, y: 103 }, index, 10);
  check("near the middle of a segment snaps onto the line", result?.type === "line" && close(result.point.x, 50) && close(result.point.y, 100), JSON.stringify(result));
}

// Outside the radius entirely -- no snap.
{
  const result = findSnap({ x: 50, y: 150 }, index, 10);
  check("far from anything returns no snap", result === null, JSON.stringify(result));
}

// The spatial index actually narrows the search -- a point far from the
// cross shouldn't even have the cross's segments among its candidates.
{
  const candidates = querySegmentsNear(index, { x: 1000, y: 1000 }, 10);
  check("querying far away returns no candidates (index actually narrows, not a disguised linear scan)", candidates.length === 0, `got ${candidates.length}`);
}

// Performance sanity on a dense sheet -- tens of thousands of segments,
// per the brief's own phrasing, built and queried without taking
// unreasonably long. This is the "measure it... and report" requirement.
{
  const dense = [];
  for (let i = 0; i < 20000; i++) {
    const x = (i % 200) * 10;
    const y = Math.floor(i / 200) * 10;
    dense.push({ a: { x, y }, b: { x: x + 8, y: y + 8 } });
  }
  const buildStart = performance.now();
  const denseIndex = buildSpatialIndex(dense, 15);
  const buildMs = performance.now() - buildStart;

  const queryStart = performance.now();
  for (let i = 0; i < 500; i++) {
    findSnap({ x: Math.random() * 2000, y: Math.random() * 1000 }, denseIndex, 8);
  }
  const queryMs = (performance.now() - queryStart) / 500;

  console.log(`    20,000-segment index build: ${buildMs.toFixed(1)} ms`);
  console.log(`    average single findSnap call against it: ${queryMs.toFixed(3)} ms`);
  check("building a 20,000-segment index takes well under a second", buildMs < 1000, `${buildMs.toFixed(1)} ms`);
  check("a single snap lookup against it averages well under a frame (16ms)", queryMs < 5, `${queryMs.toFixed(3)} ms`);
}

console.log(failed ? "\nFAILED" : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
