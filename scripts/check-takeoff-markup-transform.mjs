// Standalone proof for src/lib/pdf/takeoff-markup-transform.ts -- run with:
//   node scripts/check-takeoff-markup-transform.mjs
// Plain ESM (not a build-step entry point) importing the real, shipped
// helper by relative path -- Node's native TypeScript stripping handles
// that import fine; running the helper's own file as the *entry point*
// via node's TS stripping hits an unrelated pdfjs-dist/worker loopback
// issue, so this driver script stays plain .mjs. Not wired into any build
// or test command -- a one-off verification script, same convention as
// the Phase 1 scale-math check.
//
// For each of three pages -- normal, rotated 90 degrees, and one with an
// offset CropBox -- this: (1) builds the page with pdf-lib and marks a
// known point in pdf-lib's own drawing space; (2) asks pdf.js's own
// convertToViewportPoint for the device-space point a measuring-tool user
// would see/click at that same spot, confirming it lands in a
// geometrically sensible place for that page's rotation; (3) feeds that
// device-space point through buildPageTransform().toPdfLibPoint and checks
// it recovers the original pdf-lib point -- i.e. the exact round trip the
// export route relies on (stored device-space measurement -> pdf-lib draw
// coordinate).
import { PDFDocument, degrees } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildPageTransform } from "../src/lib/pdf/takeoff-markup-transform.ts";

let failed = false;

function closeEnough(a, b, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}

function check(label, condition, detail) {
  if (condition) {
    console.log(`  OK   ${label}`);
  } else {
    failed = true;
    console.log(`  FAIL ${label} -- ${detail}`);
  }
}

async function runCase(label, build, expectDeviceQuadrant, quadrantDescription) {
  console.log(`\n${label}`);
  const { bytes, markedPdfLibPoint } = await build();
  const transform = await buildPageTransform(bytes, 1);

  // Forward: what device-space point would a measuring-tool user see this
  // mark at? (Independent cross-check -- re-opens the PDF and asks pdf.js
  // directly, rather than only exercising our own helper both ways.)
  // .slice() -- see the comment in takeoff-markup-transform.ts: getDocument
  // detaches the buffer it's given, and buildPageTransform() above already
  // consumed (and detached its own copy of) `bytes`.
  const doc = await getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const [deviceX, deviceY] = viewport.convertToViewportPoint(markedPdfLibPoint.x, markedPdfLibPoint.y);
  await doc.destroy();

  check(
    "device point falls in the expected quadrant for this rotation",
    expectDeviceQuadrant({ x: deviceX, y: deviceY }, transform.deviceWidth, transform.deviceHeight),
    `device=(${deviceX.toFixed(1)}, ${deviceY.toFixed(1)}) size=${transform.deviceWidth}x${transform.deviceHeight}, expected ${quadrantDescription}`
  );

  // Inverse (the actual production path): device point -> pdf-lib point,
  // must recover the original mark exactly.
  const recovered = transform.toPdfLibPoint({ x: deviceX, y: deviceY });
  check(
    "round-trip recovers the original pdf-lib point",
    closeEnough(recovered.x, markedPdfLibPoint.x) && closeEnough(recovered.y, markedPdfLibPoint.y),
    `recovered=(${recovered.x.toFixed(2)}, ${recovered.y.toFixed(2)}) original=(${markedPdfLibPoint.x}, ${markedPdfLibPoint.y})`
  );
}

async function main() {
  // Case 1: a normal, unrotated US-letter page (612x792). Mark a point
  // near the top-left of the printed content (x=50, y=742 -- 50pt in,
  // 50pt down from the top). Top-left-ish PDF-space should map to the
  // top-left-ish quadrant of device space.
  await runCase(
    "Case 1: normal page (no rotation, no CropBox offset)",
    async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([612, 792]);
      page.drawCircle({ x: 50, y: 742, size: 3 });
      return { bytes: await doc.save(), markedPdfLibPoint: { x: 50, y: 742 } };
    },
    (d, w, h) => d.x < w / 2 && d.y < h / 2,
    "top-left quadrant of the device viewport"
  );

  // Case 2: the same page rotated 90 degrees (/Rotate 90). The same
  // pdf-lib point (near the top-left of the UNROTATED content) should now
  // appear visually in a DIFFERENT device-space quadrant once the viewer
  // rotation is applied -- proving the helper actually accounts for
  // /Rotate rather than ignoring it. For /Rotate 90 (clockwise), content
  // that was top-left rotates to the top-right of what's now displayed.
  await runCase(
    "Case 2: same page with /Rotate 90",
    async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([612, 792]);
      page.setRotation(degrees(90));
      page.drawCircle({ x: 50, y: 742, size: 3 });
      return { bytes: await doc.save(), markedPdfLibPoint: { x: 50, y: 742 } };
    },
    (d, w, h) => d.x > w / 2 && d.y < h / 2,
    "top-right quadrant once rotation is applied (proves /Rotate is honoured, not ignored)"
  );

  // Case 3: an unrotated page whose CropBox is shifted 100pt in from the
  // MediaBox on every side (MediaBox 612x792, CropBox [100,100,512,692] --
  // a 412x592 visible area). Mark a point just inside the crop, close to
  // its own top-left corner (x=120, y=672 -- 20pt in from the CropBox's
  // top-left, which is itself 100pt in from the MediaBox's top-left). If
  // the transform ignored the CropBox and used the MediaBox instead, this
  // point would land far from the device origin instead of near it.
  await runCase(
    "Case 3: unrotated page with an offset CropBox",
    async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([612, 792]);
      page.setCropBox(100, 100, 412, 592);
      page.drawCircle({ x: 120, y: 672, size: 3 });
      return { bytes: await doc.save(), markedPdfLibPoint: { x: 120, y: 672 } };
    },
    (d, w, h) => d.x < w * 0.1 && d.y < h * 0.1,
    "very close to the device origin (proves the CropBox offset is applied, not the raw MediaBox)"
  );

  console.log(failed ? "\nFAILED" : "\nAll checks passed.");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
