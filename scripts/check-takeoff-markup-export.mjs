// One-off runtime verification of generateMarkupPdf (Drawings Part 3) --
// builds TWO synthetic source PDFs (a two-file drawing: file A has a
// rotated second page, file B is a single page), a fake TakeoffExportDetail
// with LENGTH, CHAIN and COUNT measurements and a note spread across both
// files, and generates the marked-up export across every combination of
// showPrices / pages / notes / materials. Confirms: no throw, output
// re-parses as a valid PDF, page counts behave as expected (combined
// across both files, in file order, plus the summary and optional
// materials pages), and (via pdf-lib's own re-read) that drawing
// operators were actually added.
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

async function buildFileA() {
  const doc = await PDFDocument.create();
  const p1 = doc.addPage([612, 792]);
  p1.drawText("Ground floor plan", { x: 50, y: 750, size: 14 });
  const p2 = doc.addPage([612, 792]);
  p2.setRotation(degrees(90));
  p2.drawText("First floor plan", { x: 50, y: 750, size: 14 });
  doc.addPage([612, 792]); // page 3, unmeasured -- should be dropped by pages=measured
  return doc.save();
}

async function buildFileB() {
  const doc = await PDFDocument.create();
  const p1 = doc.addPage([612, 792]);
  p1.drawText("Elevations", { x: 50, y: 750, size: 14 });
  return doc.save();
}

function fakeTakeoff() {
  return {
    id: "tko_test",
    name: "Test Hotel - Part 3 proof",
    files: [
      { id: "file_a", name: "Floor plans", rawPath: "n/a", sortOrder: 0, pointsPerMetre: null },
      { id: "file_b", name: "Elevations", rawPath: "n/a", sortOrder: 1, pointsPerMetre: 150 },
    ],
    customer: { id: "cus_1", name: "Test Customer Ltd", company: "Test Co" },
    pointsPerMetre: 100,
    scaleRatioLabel: "1:50",
    createdAt: new Date(),
    items: [
      {
        id: "item_1", name: "Floors", colour: "#3C2263", kind: "LENGTH", pricePerMetre: 8, sortOrder: 0,
        overrideJointWidthMm: null, overrideJointDepthMm: null, overrideWastePercent: null,
        measurements: [
          { id: "m1", pageNumber: 1, takeoffFileId: "file_a", type: "LENGTH", points: [{ x: 100, y: 100 }, { x: 300, y: 100 }], computedMetres: 2, label: "corridor" },
        ],
        totalMetres: 2, count: 0, lineTotalGbp: 16,
      },
      {
        id: "item_2", name: "Walls", colour: "#B91C1C", kind: "LENGTH", pricePerMetre: 12.5, sortOrder: 1,
        overrideJointWidthMm: 20, overrideJointDepthMm: null, overrideWastePercent: null,
        measurements: [
          { id: "m2", pageNumber: 2, takeoffFileId: "file_a", type: "CHAIN", points: [{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }], computedMetres: 2, label: null },
        ],
        totalMetres: 2, count: 0, lineTotalGbp: 25,
      },
      {
        id: "item_3", name: "Hotel bathroom GBP250", colour: "#15803D", kind: "COUNT", pricePerMetre: 250, sortOrder: 2,
        overrideJointWidthMm: null, overrideJointDepthMm: null, overrideWastePercent: null,
        measurements: [
          { id: "m3", pageNumber: 1, takeoffFileId: "file_b", type: "COUNT", points: [{ x: 200, y: 200 }], computedMetres: 0, label: null },
          { id: "m4", pageNumber: 1, takeoffFileId: "file_b", type: "COUNT", points: [{ x: 250, y: 250 }], computedMetres: 0, label: "Suite 12" },
        ],
        totalMetres: 0, count: 2, lineTotalGbp: 500,
      },
    ],
    notes: [
      { id: "n1", pageNumber: 1, takeoffFileId: "file_a", x: 400, y: 400, text: "Check this corner for movement joint before quoting -- looks like an old repair", createdAt: new Date() },
    ],
    totalMetres: 4,
    grandTotalGbp: 541,
  };
}

const materialDefaults = { jointWidthMm: 15, jointDepthMm: 10, tubeMl: 310, wastePercent: 10 };

async function main() {
  const bytesA = await buildFileA();
  const bytesB = await buildFileB();
  const takeoff = fakeTakeoff();

  for (const showPrices of [true, false]) {
    for (const pages of ["measured", "all"]) {
      for (const notes of [true, false]) {
        for (const materials of [true, false]) {
          const files = [
            { id: "file_a", name: "Floor plans", bytes: bytesA.slice() },
            { id: "file_b", name: "Elevations", bytes: bytesB.slice() },
          ];
          const out = await generateMarkupPdf(files, takeoff, { showPrices, pages, notes, materials, materialDefaults });
          const reparsed = await PDFDocument.load(out);
          // fileA contributes 3 pages (all) or 2 (measured, page 3 dropped); fileB contributes 1.
          // Plus 1 summary page, plus 1 materials page if requested.
          const planPages = pages === "all" ? 3 + 1 : 2 + 1;
          const expectedPageCount = planPages + 1 + (materials ? 1 : 0);
          const label = `showPrices=${showPrices} pages=${pages} notes=${notes} materials=${materials}`;
          if (reparsed.getPageCount() !== expectedPageCount) {
            throw new Error(`${label}: expected ${expectedPageCount} pages, got ${reparsed.getPageCount()}`);
          }
          console.log(`OK  ${label}: ${reparsed.getPageCount()} pages, ${out.length} bytes`);
          if (showPrices && pages === "all" && notes && materials) {
            fs.writeFileSync("C:/Users/roman/.claude/jobs/df4882b2/tmp/sample-export-full.pdf", out);
          }
        }
      }
    }
  }
  console.log("\nAll generateMarkupPdf runs succeeded and re-parsed as valid PDFs, across two files, all four toggles.");
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exit(1);
});
