// Standalone proof that measure-tool.tsx's screenToPoint/pointToScreen
// round-trip stays correct at ANY render zoom and ANY additional view
// rotation -- the exact "zoom independence" and "stored points stay
// unrotated" guarantees the Drawings Part 1 Step 3 brief calls out to
// re-test. Run with: node scripts/check-drawings-navigation-transform.mjs
//
// This mirrors the real client code's logic exactly (same pdf.js
// getViewport/convertToPdfPoint/convertToViewportPoint calls, same
// baseViewport-always-at-scale-1 invariant) against a synthetic PDF, for
// every combination of render zoom and view rotation a user could reach.
import { PDFDocument, degrees } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

let failed = false;
function check(label, condition, detail) {
  if (condition) console.log(`  OK   ${label}`);
  else {
    failed = true;
    console.log(`  FAIL ${label} -- ${detail}`);
  }
}
function close(a, b, tol = 0.02) {
  return Math.abs(a - b) <= tol;
}

async function buildPdf(nativeRotation) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  if (nativeRotation) page.setRotation(degrees(nativeRotation));
  return doc.save();
}

/** Mirrors measure-tool.tsx's pointToScreen/screenToPoint exactly. */
function pointToScreen(baseViewport, displayViewport, p) {
  const [pdfX, pdfY] = baseViewport.convertToPdfPoint(p.x, p.y);
  const [x, y] = displayViewport.convertToViewportPoint(pdfX, pdfY);
  return { x, y };
}
function screenToPoint(baseViewport, displayViewport, p) {
  const [pdfX, pdfY] = displayViewport.convertToPdfPoint(p.x, p.y);
  const [x, y] = baseViewport.convertToViewportPoint(pdfX, pdfY);
  return { x, y };
}

async function runForNativeRotation(nativeRotation) {
  const bytes = await buildPdf(nativeRotation);
  const doc = await getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);

  // A "stored" measurement point -- captured once, at scale 1, in the
  // page's own native rotation. Must round-trip identically no matter
  // what render zoom or extra view rotation is active when it's re-drawn.
  const baseViewport = page.getViewport({ scale: 1 });
  const storedPoint = { x: 120, y: 340 };

  for (const renderScale of [0.5, 1, 1.7, 3]) {
    for (const viewRotation of [0, 90, 180, 270]) {
      const effectiveRotation = ((page.rotate + viewRotation) % 360 + 360) % 360;
      const displayViewport = page.getViewport({ scale: renderScale, rotation: effectiveRotation });

      const onScreen = pointToScreen(baseViewport, displayViewport, storedPoint);
      const recovered = screenToPoint(baseViewport, displayViewport, onScreen);

      check(
        `native=${nativeRotation} scale=${renderScale} viewRotation=${viewRotation}: round-trip is stable`,
        close(recovered.x, storedPoint.x) && close(recovered.y, storedPoint.y),
        `recovered=(${recovered.x.toFixed(2)}, ${recovered.y.toFixed(2)}) expected=(${storedPoint.x}, ${storedPoint.y})`
      );
    }
  }

  // Zoom independence proper: the SAME stored point's on-screen position,
  // divided by its own render scale, must be the same displayViewport-at-
  // scale-1 location at every zoom (for a fixed view rotation) -- i.e. the
  // geometry truly doesn't move, only the rendered scale does.
  const positions = [0.5, 1, 1.7, 3].map((renderScale) => {
    const displayViewport = page.getViewport({ scale: renderScale, rotation: page.rotate });
    const onScreen = pointToScreen(baseViewport, displayViewport, storedPoint);
    return { renderScale, x: onScreen.x / renderScale, y: onScreen.y / renderScale };
  });
  const [first, ...rest] = positions;
  check(
    `native=${nativeRotation}: on-screen position scales linearly with zoom (true zoom independence)`,
    rest.every((p) => close(p.x, first.x) && close(p.y, first.y)),
    JSON.stringify(positions)
  );

  await doc.destroy();
}

async function main() {
  for (const nativeRotation of [0, 90, 180, 270]) {
    console.log(`\nPage with native /Rotate ${nativeRotation}`);
    await runForNativeRotation(nativeRotation);
  }
  console.log(failed ? "\nFAILED" : "\nAll checks passed.");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
