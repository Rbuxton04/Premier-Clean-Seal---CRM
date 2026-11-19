// Standalone test for snapPointToAngle (validators/takeoff.ts) -- the pure
// angle-snap math behind Drawings Part 2 section 2's Shift straight-line
// lock. Run with: node scripts/check-takeoff-shift-lock.mjs
//
// This tests the snap math only, in a generic coordinate space. The
// "respects the current view rotation" requirement is satisfied by the
// caller (measure-tool.tsx's applyShiftLock) doing this snap in on-screen
// display space -- already proven correct at any rotation by
// check-drawings-navigation-transform.mjs -- not by anything in this
// function, which doesn't know about rotation at all.
import { snapPointToAngle } from "../src/validators/takeoff.ts";

let failed = false;
function check(label, condition, detail) {
  if (condition) console.log(`  OK   ${label}`);
  else {
    failed = true;
    console.log(`  FAIL ${label} -- ${detail}`);
  }
}
function close(a, b, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

const from = { x: 100, y: 100 };

// A point nearly due east (small y offset) should snap exactly onto the
// horizontal (0 degrees), at the same distance from `from`.
{
  const raw = { x: 150, y: 105 }; // mostly +x, slight +y
  const snapped = snapPointToAngle(from, raw);
  const distance = Math.hypot(raw.x - from.x, raw.y - from.y);
  check("near-horizontal snaps to exactly horizontal (0 deg)", close(snapped.y, from.y), `snapped=(${snapped.x.toFixed(2)}, ${snapped.y.toFixed(2)})`);
  check("distance from the start point is preserved", close(Math.hypot(snapped.x - from.x, snapped.y - from.y), distance), `got ${Math.hypot(snapped.x - from.x, snapped.y - from.y)} expected ${distance}`);
}

// A point nearly due south should snap to vertical (90 degrees).
{
  const raw = { x: 103, y: 150 };
  const snapped = snapPointToAngle(from, raw);
  check("near-vertical snaps to exactly vertical (90 deg)", close(snapped.x, from.x), `snapped=(${snapped.x.toFixed(2)}, ${snapped.y.toFixed(2)})`);
}

// A point near 45 degrees (equal x/y offset) should snap to the diagonal, x and y offsets equal.
{
  const raw = { x: 150, y: 153 };
  const snapped = snapPointToAngle(from, raw);
  check("near-diagonal snaps to exactly 45 degrees (equal offsets)", close(snapped.x - from.x, snapped.y - from.y), `dx=${(snapped.x - from.x).toFixed(2)} dy=${(snapped.y - from.y).toFixed(2)}`);
}

// All four quadrants, and their mirrored diagonals, snap to one of exactly
// eight directions (0/45/90/135/180/225/270/315), never anything else.
{
  const validAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  let allValid = true;
  for (const testAngle of [10, 40, 80, 100, 170, 200, 260, 300, 350]) {
    const rad = (testAngle * Math.PI) / 180;
    const raw = { x: from.x + 50 * Math.cos(rad), y: from.y + 50 * Math.sin(rad) };
    const snapped = snapPointToAngle(from, raw);
    const snappedDeg = ((Math.atan2(snapped.y - from.y, snapped.x - from.x) * 180) / Math.PI + 360) % 360;
    const matches = validAngles.some((a) => Math.abs(((snappedDeg - a + 540) % 360) - 180) < 0.5);
    if (!matches) {
      allValid = false;
      console.log(`    unexpected snap angle ${snappedDeg.toFixed(1)} for test angle ${testAngle}`);
    }
  }
  check("every tested raw angle snaps to one of the 8 valid directions", allValid, "see above");
}

// A point exactly at the start (zero distance) doesn't divide by zero or throw.
{
  const snapped = snapPointToAngle(from, { x: from.x, y: from.y });
  check("zero-distance point doesn't throw or produce NaN", Number.isFinite(snapped.x) && Number.isFinite(snapped.y), JSON.stringify(snapped));
}

console.log(failed ? "\nFAILED" : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
