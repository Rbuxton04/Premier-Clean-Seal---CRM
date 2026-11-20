// Standalone proof for src/lib/pdf/takeoff-vector-extraction.ts (Drawings
// Part 2, section 1 -- snap to geometry) against REAL pdf.js operator
// lists, not a synthetic/assumed one. Run with:
//   node scripts/check-takeoff-vector-extraction.mjs
import { PDFDocument, degrees } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractLineSegments } from "../src/lib/pdf/takeoff-vector-extraction.ts";

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
function hasSegmentNear(segments, ax, ay, bx, by, tol = 1) {
  return segments.some(
    (s) =>
      (close(s.a.x, ax, tol) && close(s.a.y, ay, tol) && close(s.b.x, bx, tol) && close(s.b.y, by, tol)) ||
      (close(s.a.x, bx, tol) && close(s.a.y, by, tol) && close(s.b.x, ax, tol) && close(s.b.y, ay, tol))
  );
}

async function getOperatorListFor(bytes) {
  const doc = await getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const opList = await page.getOperatorList();
  await doc.destroy();
  return opList;
}

// Case 1: a plain line, no transform beyond the identity.
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.drawLine({ start: { x: 50, y: 50 }, end: { x: 250, y: 250 }, thickness: 2 });
  const bytes = await doc.save();
  const opList = await getOperatorListFor(bytes);
  const { segments, capped } = extractLineSegments(opList.fnArray, opList.argsArray);
  check("plain line: finds the (50,50)-(250,250) segment", hasSegmentNear(segments, 50, 50, 250, 250), JSON.stringify(segments));
  check("plain line: not capped", !capped, "capped was true unexpectedly");
}

// Case 2: a rectangle outline, drawn with a translate transform (20,20) --
// proves the CTM (save/restore/transform replay) is actually applied, not
// just the raw local path coordinates.
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.drawRectangle({ x: 20, y: 20, width: 50, height: 30, borderWidth: 1, borderColor: { red: 0, green: 0, blue: 0, type: "RGB" } });
  const bytes = await doc.save();
  const opList = await getOperatorListFor(bytes);
  const { segments } = extractLineSegments(opList.fnArray, opList.argsArray);
  // The rectangle's four corners in PAGE space should be (20,20), (20,50), (70,50), (70,20).
  check(
    "translated rectangle: bottom edge lands at page-space (20,20)-(70,20), not local (0,0)-(50,0)",
    hasSegmentNear(segments, 20, 20, 70, 20),
    JSON.stringify(segments)
  );
  check("translated rectangle: left edge at (20,20)-(20,50)", hasSegmentNear(segments, 20, 20, 20, 50), JSON.stringify(segments));
}

// Case 3: a line on a page with an additional 90-degree page rotation --
// the brief's own extraction has nothing to do with view rotation (that's
// Step 3's screen-space concern); the raw page-point-space segment should
// be unaffected by the page's /Rotate value, since pdf.js's
// getOperatorList() returns PDF user-space coordinates regardless of
// /Rotate (the same space stored measurement points are in).
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.setRotation(degrees(90));
  page.drawLine({ start: { x: 10, y: 10 }, end: { x: 100, y: 10 }, thickness: 1 });
  const bytes = await doc.save();
  const opList = await getOperatorListFor(bytes);
  const { segments } = extractLineSegments(opList.fnArray, opList.argsArray);
  check("rotated page: segment is still in raw PDF user space, unaffected by /Rotate", hasSegmentNear(segments, 10, 10, 100, 10), JSON.stringify(segments));
}

// Case 4: a page with nested save/transform/restore (translate then scale,
// then restore back) -- proves the CTM stack actually pushes/pops rather
// than leaking a transform into unrelated content.
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.pushOperators((await import("pdf-lib")).pushGraphicsState());
  const { translate, scale, popGraphicsState, concatTransformationMatrix } = await import("pdf-lib");
  page.pushOperators(concatTransformationMatrix(1, 0, 0, 1, 100, 100));
  page.drawLine({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: 1 }); // should land at (100,100)-(110,100)
  page.pushOperators(popGraphicsState());
  page.drawLine({ start: { x: 5, y: 5 }, end: { x: 15, y: 5 }, thickness: 1 }); // after restore, back to untranslated -- (5,5)-(15,5)
  const bytes = await doc.save();
  const opList = await getOperatorListFor(bytes);
  const { segments } = extractLineSegments(opList.fnArray, opList.argsArray);
  check("inside the pushed transform: line lands at (100,100)-(110,100)", hasSegmentNear(segments, 100, 100, 110, 100), JSON.stringify(segments));
  check("after restore: line is back at the untranslated (5,5)-(15,5), not leaked +100", hasSegmentNear(segments, 5, 5, 15, 5), JSON.stringify(segments));
}

console.log(failed ? "\nFAILED" : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
