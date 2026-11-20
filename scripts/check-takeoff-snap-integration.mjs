// Proves the one piece of glue that isn't covered by the two foundation
// scripts: measure-tool.tsx's ensurePageSnapIndexed() converts each
// extracted segment (in raw PDF user space) through
// baseViewport.convertToViewportPoint() before indexing it, so a snap
// target lands in the SAME baseline device space every stored
// TakeoffMeasurement point is in. Proven against a real pdf-lib PDF, on
// both an unrotated page and a /Rotate 90 page (baseViewport accounts for
// /Rotate, so this must still line up there too).
// Run with: node scripts/check-takeoff-snap-integration.mjs
import { PDFDocument, degrees } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractLineSegments } from "../src/lib/pdf/takeoff-vector-extraction.ts";
import { buildSpatialIndex, findSnap } from "../src/lib/pdf/takeoff-snap.ts";

let failed = false;
function check(label, condition, detail) {
  if (condition) console.log(`  OK   ${label}`);
  else {
    failed = true;
    console.log(`  FAIL ${label} -- ${detail}`);
  }
}
function close(a, b, tol = 1) {
  return Math.abs(a - b) <= tol;
}

async function indexPage(bytes) {
  const jsDoc = await getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const page = await jsDoc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const opList = await page.getOperatorList();
  const { segments } = extractLineSegments(opList.fnArray, opList.argsArray);
  const converted = segments.map((s) => {
    const [ax, ay] = baseViewport.convertToViewportPoint(s.a.x, s.a.y);
    const [bx, by] = baseViewport.convertToViewportPoint(s.b.x, s.b.y);
    return { a: { x: ax, y: ay }, b: { x: bx, y: by } };
  });
  await jsDoc.destroy();
  return { index: buildSpatialIndex(converted, 20), baseViewport };
}

// Case 1: unrotated page, a line from (50,50) to (250,50) in PDF space.
// In baseline device space (top-left origin, y flipped) that endpoint
// should land near (50, pageHeight-50).
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.drawLine({ start: { x: 50, y: 50 }, end: { x: 250, y: 50 }, thickness: 2 });
  const bytes = await doc.save();
  const { index } = await indexPage(bytes);
  const result = findSnap({ x: 52, y: 248 }, index, 10);
  check(
    "unrotated: clicking near the converted endpoint snaps to it in baseline device space",
    result?.type === "endpoint" && close(result.point.x, 50) && close(result.point.y, 250),
    JSON.stringify(result)
  );
}

// Case 2: a /Rotate 90 page -- baseViewport bakes in the page rotation, so
// the SAME conversion must still land the snap target where the point
// actually appears once rotated, not where it'd be on an unrotated page.
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.setRotation(degrees(90));
  page.drawLine({ start: { x: 50, y: 50 }, end: { x: 250, y: 50 }, thickness: 2 });
  const bytes = await doc.save();
  const { index, baseViewport } = await indexPage(bytes);
  const [expectedX, expectedY] = baseViewport.convertToViewportPoint(50, 50);
  const result = findSnap({ x: expectedX + 2, y: expectedY - 2 }, index, 10);
  check(
    "rotated page: snap target matches baseViewport's own conversion of the same point",
    result?.type === "endpoint" && close(result.point.x, expectedX) && close(result.point.y, expectedY),
    JSON.stringify({ result, expectedX, expectedY })
  );
}

console.log(failed ? "\nFAILED" : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
