// Standalone proof for measure-tool.tsx's indexFileForSearch: that a text
// item's getTextContent() transform/width/height correctly locates it in
// the SAME baseline device space pointToScreen expects, for both a normal
// and a rotated page. Run with:
//   node scripts/check-drawings-search-highlight.mjs
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

let failed = false;
function check(label, condition, detail) {
  if (condition) console.log(`  OK   ${label}`);
  else {
    failed = true;
    console.log(`  FAIL ${label} -- ${detail}`);
  }
}
function close(a, b, tol = 3) {
  return Math.abs(a - b) <= tol;
}

async function buildPdf(nativeRotation) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  if (nativeRotation) page.setRotation(degrees(nativeRotation));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // A known marker string, drawn at a known PDF-user-space position.
  page.drawText("FINDME", { x: 200, y: 600, size: 24, font });
  return doc.save();
}

async function runForRotation(nativeRotation) {
  const bytes = await buildPdf(nativeRotation);
  const doc = await getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();

  const match = textContent.items.find((it) => "str" in it && it.str.includes("FINDME"));
  check(`native=${nativeRotation}: getTextContent finds the marker text`, Boolean(match), "no item contained FINDME");
  if (!match) {
    await doc.destroy();
    return;
  }

  const [, , , , e, f] = match.transform;
  const p0 = baseViewport.convertToViewportPoint(e, f);
  const p1 = baseViewport.convertToViewportPoint(e + match.width, f + (match.height || 10));
  const minX = Math.min(p0[0], p1[0]), minY = Math.min(p0[1], p1[1]);
  const maxX = Math.max(p0[0], p1[0]), maxY = Math.max(p0[1], p1[1]);

  // Independent cross-check: ask pdf.js directly where the drawn point
  // (200, 600) in PDF-user-space lands in this same baseline device space
  // -- the marker's box must contain that point (with a little slack for
  // font metrics/baseline offset), proving the box is in the right place,
  // not just a self-consistent round trip of the same numbers.
  const [drawnX, drawnY] = baseViewport.convertToViewportPoint(200, 600);
  check(
    `native=${nativeRotation}: marker box contains the point it was drawn at`,
    drawnX >= minX - 5 && drawnX <= maxX + 5 && drawnY >= minY - 30 && drawnY <= maxY + 10,
    `box=(${minX.toFixed(1)},${minY.toFixed(1)})-(${maxX.toFixed(1)},${maxY.toFixed(1)}) drawnPoint=(${drawnX.toFixed(1)},${drawnY.toFixed(1)})`
  );
  check(`native=${nativeRotation}: box has a sane, non-zero size`, maxX - minX > 5 && maxY - minY > 5, `width=${(maxX - minX).toFixed(1)} height=${(maxY - minY).toFixed(1)}`);

  await doc.destroy();
}

async function main() {
  for (const nativeRotation of [0, 90, 180, 270]) {
    console.log(`\nPage with native /Rotate ${nativeRotation}`);
    await runForRotation(nativeRotation);
  }
  console.log(failed ? "\nFAILED" : "\nAll checks passed.");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
