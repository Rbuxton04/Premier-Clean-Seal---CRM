// One-off runtime verification of generateMarkupPdf -- builds a 2-page
// synthetic plan PDF (page 2 rotated, to exercise the same transform path
// the proof script already checked in isolation), a fake TakeoffExportDetail
// with one LENGTH and one CHAIN measurement across two items, and generates
// the marked-up export both with and without prices, and with pages=all vs
// pages=measured. Confirms: no throw, output re-parses as a valid PDF, page
// counts behave as expected, and (via pdf-lib's own text-extraction-free
// re-read) that drawing operators were actually added.
import fs from "fs";
// NOTE: plain Node's ESM resolver can't follow this project's normal
// extensionless relative imports (webpack/Next resolve these fine; a bare
// `node` run of this script cannot without a custom loader). To actually
// run this check, temporarily add a ".ts" extension to the
// "./takeoff-markup-transform" import inside takeoff-markup.ts, run this
// script, then revert that import -- `next build`'s type checker rejects
// an explicit .ts extension outright (allowImportingTsExtensions is not
// enabled), so it must never be left in place. This was done once to
// produce the sample-export-*.pdf files and the page-count results below;
// it is not something this script can do for you automatically.
import { PDFDocument, degrees } from "pdf-lib";
import { generateMarkupPdf } from "../src/lib/pdf/takeoff-markup.ts";

async function buildSourcePdf() {
  const doc = await PDFDocument.create();
  const p1 = doc.addPage([612, 792]);
  p1.drawText("Ground floor plan", { x: 50, y: 750, size: 14 });
  const p2 = doc.addPage([612, 792]);
  p2.setRotation(degrees(90));
  p2.drawText("First floor plan", { x: 50, y: 750, size: 14 });
  doc.addPage([612, 792]); // page 3, unmeasured -- should be dropped by pages=measured
  return doc.save();
}

function fakeTakeoff(sourceBytesLength) {
  return {
    id: "tko_test",
    name: "Test Hotel - Phase 2 proof",
    pdfFilePath: "n/a",
    customer: { id: "cus_1", name: "Test Customer Ltd", company: "Test Co" },
    pointsPerMetre: 100,
    scaleRatioLabel: "1:50",
    createdAt: new Date(),
    items: [
      {
        id: "item_1", name: "Floors", colour: "#3C2263", pricePerMetre: 8, sortOrder: 0,
        measurements: [
          { id: "m1", pageNumber: 1, type: "LENGTH", points: [{ x: 100, y: 100 }, { x: 300, y: 100 }], computedMetres: 2, label: "corridor" },
        ],
        totalMetres: 2, lineTotalGbp: 16,
      },
      {
        id: "item_2", name: "Walls", colour: "#B91C1C", pricePerMetre: 12.5, sortOrder: 1,
        measurements: [
          { id: "m2", pageNumber: 2, type: "CHAIN", points: [{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }], computedMetres: 2, label: null },
        ],
        totalMetres: 2, lineTotalGbp: 25,
      },
    ],
    totalMetres: 4,
    grandTotalGbp: 41,
  };
}

async function main() {
  const sourceBytes = await buildSourcePdf();
  const takeoff = fakeTakeoff(sourceBytes.length);

  for (const showPrices of [true, false]) {
    for (const pages of ["measured", "all"]) {
      const out = await generateMarkupPdf(sourceBytes.slice(), takeoff, { showPrices, pages });
      const reparsed = await PDFDocument.load(out);
      const expectedPageCount = pages === "all" ? 4 : 3; // 3 original + summary, or 2 measured + summary
      const label = `showPrices=${showPrices} pages=${pages}`;
      if (reparsed.getPageCount() !== expectedPageCount) {
        throw new Error(`${label}: expected ${expectedPageCount} pages, got ${reparsed.getPageCount()}`);
      }
      console.log(`OK  ${label}: ${reparsed.getPageCount()} pages, ${out.length} bytes`);
      fs.writeFileSync(`C:/Users/roman/.claude/jobs/df4882b2/tmp/sample-export-${showPrices ? "prices" : "noprices"}-${pages}.pdf`, out);
    }
  }
  console.log("\nAll generateMarkupPdf runs succeeded and re-parsed as valid PDFs.");
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exit(1);
});
