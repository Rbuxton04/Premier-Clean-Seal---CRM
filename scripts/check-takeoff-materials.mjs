// Standalone runtime test for calculateMaterialTubes (validators/takeoff.ts)
// -- the worst-case-materials maths from Drawings Part 2, section 6. Run
// with: node scripts/check-takeoff-materials.mjs
import { calculateMaterialTubes } from "../src/validators/takeoff.ts";

let failed = false;
function check(label, condition, detail) {
  if (condition) console.log(`  OK   ${label}`);
  else {
    failed = true;
    console.log(`  FAIL ${label} -- ${detail}`);
  }
}

const defaults = { jointWidthMm: 15, jointDepthMm: 10, tubeMl: 310, wastePercent: 10 };

// The brief's own worked example: 32.4m at 15x10mm (150 ml/m) + 10% waste
// should be 5346 ml, needing 18 tubes of 310ml (17.25 rounded up).
{
  const r = calculateMaterialTubes(32.4, defaults);
  check("brief's worked example: mlNeeded = 5346", Math.abs(r.mlNeeded - 5346) < 0.5, `got ${r.mlNeeded}`);
  check("brief's worked example: tubesNeeded = 18", r.tubesNeeded === 18, `got ${r.tubesNeeded}`);
  check("defaults: both width and depth flagged as default", r.widthIsDefault && r.depthIsDefault && r.wasteIsDefault, JSON.stringify(r));
}

// Per-item override -- a wider/deeper joint than the org default, waste left at default.
{
  const r = calculateMaterialTubes(10, defaults, { jointWidthMm: 20, jointDepthMm: 15 });
  // 20*15=300 ml/m, 10m -> 3000ml, +10% = 3300ml, /310 = 10.64 -> 11 tubes
  check("override width/depth changes ml/m", r.jointWidthMm === 20 && r.jointDepthMm === 15, JSON.stringify(r));
  check("override: waste stays the org default (10%)", r.wastePercent === 10 && r.wasteIsDefault, JSON.stringify(r));
  check("override: width/depth no longer flagged as default", !r.widthIsDefault && !r.depthIsDefault, JSON.stringify(r));
  check("override maths: 11 tubes", r.tubesNeeded === 11, `got ${r.tubesNeeded}`);
}

// Always rounds UP, never down, even when only fractionally over a tube boundary.
{
  // 1 metre at 15x10mm = 150ml, no waste override -> with defaults +10% = 165ml. One 310ml tube covers it with room to spare, but should still show 1, not 0.
  const r1 = calculateMaterialTubes(1, defaults);
  check("1m needs at least 1 tube, not 0", r1.tubesNeeded === 1, `got ${r1.tubesNeeded}`);

  // Craft a case that lands EXACTLY on a tube boundary plus a hair over, to prove ceil (not round) is used.
  // 310ml tube, no waste, 31mm x 10mm joint (310 ml/m) at 1.001m = 310.31ml -> must be 2 tubes, not 1.
  const r2 = calculateMaterialTubes(1.001, { jointWidthMm: 31, jointDepthMm: 10, tubeMl: 310, wastePercent: 0 });
  check("just over one tube's worth rounds up to 2, not down to 1", r2.tubesNeeded === 2, `mlNeeded=${r2.mlNeeded} tubes=${r2.tubesNeeded}`);
}

// Zero metres -- an item with no measurements yet needs zero tubes, not an error or NaN.
{
  const r = calculateMaterialTubes(0, defaults);
  check("zero metres needs zero tubes", r.tubesNeeded === 0, `got ${r.tubesNeeded}`);
  check("zero metres: no NaN anywhere", Number.isFinite(r.mlNeeded) && Number.isFinite(r.tubesNeeded), JSON.stringify(r));
}

// A larger tube size (600ml) needs fewer tubes for the same run.
{
  const bigTube = { ...defaults, tubeMl: 600 };
  const rSmall = calculateMaterialTubes(50, defaults);
  const rBig = calculateMaterialTubes(50, bigTube);
  check("a bigger tube size needs no more tubes than a smaller one for the same run", rBig.tubesNeeded <= rSmall.tubesNeeded, `small=${rSmall.tubesNeeded} big=${rBig.tubesNeeded}`);
}

console.log(failed ? "\nFAILED" : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
