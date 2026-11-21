import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { openPdfForTransforms, type PageTransform, type MarkupPoint } from "./takeoff-markup-transform";
import type { TakeoffExportDetail, TakeoffExportFile } from "@/services/takeoff.service";
// A relative import, not the usual @/ alias -- this file (like its sibling
// takeoff-markup-transform.ts) needs to stay resolvable by a bare `node`
// run of scripts/check-takeoff-markup-export.mjs, which has no path-alias
// resolution of its own.
import { calculateMaterialTubes, type MaterialDefaultsValues } from "../../validators/takeoff";

// Generates the marked-up plan PDF for the Drawings export (GET
// /api/drawings/[id]/export). Draws vector lines/labels/markers/pins
// straight onto each ORIGINAL plan's own pages (quality is preserved at
// any zoom, unlike a rasterised screenshot), combines every one of a
// drawing's files into a single output document in tab order, then
// appends a branded summary page and an optional materials page, matching
// the look of quote-pdf.tsx as closely as pdf-lib's lower-level drawing
// API allows (that file uses @react-pdf/renderer's layout engine; this
// one draws absolute x/y, since it also has to draw onto pre-existing
// pages).
//
// On-plan measurement labels never show money, on-screen UI or export --
// see items-panel.tsx / measure-tool.tsx, which only ever show
// "{metres}m[ - label]" next to a line. So the showPrices toggle only
// changes the SUMMARY page (its rate/line-total/grand-total columns), not
// the plan pages themselves; "hides money from on-plan labels when off"
// is satisfied because there was never any money on them to hide.

const PLUM: RGB = rgb(0x3c / 255, 0x22 / 255, 0x63 / 255);
const SLATE: RGB = rgb(0x58 / 255, 0x60 / 255, 0x6b / 255);
const INK: RGB = rgb(0x2e / 255, 0x33 / 255, 0x3b / 255);
const WHITE: RGB = rgb(1, 1, 1);
const RULE: RGB = rgb(0xe0 / 255, 0xe0 / 255, 0xe0 / 255);

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;

function gbp(n: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export type ExportOptions = {
  showPrices: boolean;
  pages: "measured" | "all";
  /** Draw note pins/callouts on the plan pages -- default off (internal annotations, not always wanted on a copy sent out). */
  notes: boolean;
  /** Append the worst-case materials ordering page -- default off. Only used when true. */
  materials: boolean;
  /** Only read when materials is true. */
  materialDefaults?: MaterialDefaultsValues;
};

/** One source file's already-downloaded bytes, in the order they should appear in the combined output. */
export type ExportFileInput = { id: string; name: string; bytes: Uint8Array };

/**
 * bytes are read twice per file here (once by pdf-lib's PDFDocument.load,
 * once by openPdfForTransforms -- which internally .slice()s its own
 * copy, see that module's comment on buffer transfer/detachment), so the
 * caller's buffers are safe to pass to both without any extra copying of
 * their own.
 */
export async function generateMarkupPdf(files: ExportFileInput[], takeoff: TakeoffExportDetail, options: ExportOptions): Promise<Buffer> {
  const outDoc = await PDFDocument.create();
  const labelFont = await outDoc.embedFont(StandardFonts.Helvetica);
  const markerFont = await outDoc.embedFont(StandardFonts.HelveticaBold);
  // A null takeoffFileId on a measurement/note means "the drawing's first
  // file" -- the same safety-net convention documented on
  // TakeoffMeasurement.takeoffFileId.
  const firstFileId = takeoff.files[0]?.id ?? files[0]?.id ?? null;

  // Each COUNT marker's sequence number for its own item, across the
  // WHOLE drawing (every file, not just the one being drawn right now) --
  // "the same numbered dots as on screen", matching measure-tool.tsx's
  // countMarkerNumbers exactly (same per-item, measurement-array-order
  // numbering).
  const countMarkerNumbers = new Map<string, number>();
  for (const item of takeoff.items) {
    let n = 0;
    for (const m of item.measurements) if (m.type === "COUNT") countMarkerNumbers.set(m.id, ++n);
  }

  for (const file of files) {
    const srcDoc = await PDFDocument.load(file.bytes);
    const pageNumbersWithContent = new Set<number>();
    for (const item of takeoff.items) {
      for (const m of item.measurements) {
        if ((m.takeoffFileId ?? firstFileId) === file.id) pageNumbersWithContent.add(m.pageNumber);
      }
    }
    if (options.notes) {
      for (const note of takeoff.notes) {
        if ((note.takeoffFileId ?? firstFileId) === file.id) pageNumbersWithContent.add(note.pageNumber);
      }
    }

    if (pageNumbersWithContent.size > 0) {
      const { getPageTransform, destroy } = await openPdfForTransforms(file.bytes);
      try {
        for (const pageNumber of Array.from(pageNumbersWithContent)) {
          // Defensive: a measurement/note's page could in principle
          // outlive the source PDF it referred to (e.g. a re-uploaded,
          // shorter file) -- skip rather than throw.
          if (pageNumber < 1 || pageNumber > srcDoc.getPageCount()) continue;
          const transform = await getPageTransform(pageNumber);
          const libPage = srcDoc.getPage(pageNumber - 1);
          drawPageMeasurements(libPage, transform, takeoff.items, file.id, firstFileId, pageNumber, labelFont, markerFont, countMarkerNumbers);
          if (options.notes) drawPageNotes(libPage, transform, takeoff.notes, file.id, firstFileId, pageNumber, labelFont);
        }
      } finally {
        await destroy();
      }
    }

    const pageIndices =
      options.pages === "all"
        ? srcDoc.getPageIndices()
        : Array.from(pageNumbersWithContent)
            .map((n) => n - 1)
            .sort((a, b) => a - b);
    if (pageIndices.length === 0) continue; // this file contributes nothing to a measured-only export
    const copiedPages = await outDoc.copyPages(srcDoc, pageIndices);
    for (const copied of copiedPages) outDoc.addPage(copied);
  }

  const bodyFont = await outDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await outDoc.embedFont(StandardFonts.HelveticaBold);
  await appendSummaryPage(outDoc, takeoff, files, bodyFont, boldFont, options.showPrices);
  if (options.materials && options.materialDefaults) appendMaterialsPage(outDoc, takeoff, options.materialDefaults, bodyFont, boldFont);

  const outBytes = await outDoc.save();
  return Buffer.from(outBytes);
}

// ---------------------------------------------------------------------------
// On-plan markup
// ---------------------------------------------------------------------------

function drawPageMeasurements(
  libPage: PDFPage,
  transform: PageTransform,
  items: TakeoffExportDetail["items"],
  fileId: string,
  firstFileId: string | null,
  pageNumber: number,
  font: PDFFont,
  markerFont: PDFFont,
  countMarkerNumbers: Map<string, number>
) {
  for (const item of items) {
    const colour = hexToRgb(item.colour);
    for (const m of item.measurements) {
      if (m.pageNumber !== pageNumber) continue;
      if ((m.takeoffFileId ?? firstFileId) !== fileId) continue;
      const pdfPoints = m.points.map((p) => transform.toPdfLibPoint(p));

      if (m.type === "COUNT") {
        drawCountMarker(libPage, pdfPoints[0], countMarkerNumbers.get(m.id) ?? 0, colour, markerFont);
        if (m.label) drawLabel(libPage, { x: pdfPoints[0].x + 10, y: pdfPoints[0].y + 10 }, m.label, font, colour);
        continue;
      }

      for (let i = 1; i < pdfPoints.length; i++) {
        libPage.drawLine({ start: pdfPoints[i - 1], end: pdfPoints[i], thickness: 1.5, color: colour });
      }
      for (const p of pdfPoints) {
        libPage.drawCircle({ x: p.x, y: p.y, size: 2.5, color: colour });
      }

      const anchor = pdfPoints[Math.floor(pdfPoints.length / 2)];
      const text = `${Number(m.computedMetres)}m${m.label ? ` - ${m.label}` : ""}`;
      drawLabel(libPage, anchor, text, font, colour);
    }
  }
}

/** A numbered coloured dot, matching the on-screen COUNT marker exactly (see measure-tool.tsx's SVG <circle>/<text> for a COUNT measurement). */
function drawCountMarker(page: PDFPage, p: MarkupPoint, n: number, colour: RGB, markerFont: PDFFont) {
  const r = 7;
  page.drawCircle({ x: p.x, y: p.y, size: r, color: colour, borderColor: WHITE, borderWidth: 1.5 });
  const text = String(n);
  const size = 8;
  const textWidth = markerFont.widthOfTextAtSize(text, size);
  page.drawText(text, { x: p.x - textWidth / 2, y: p.y - size * 0.36, size, font: markerFont, color: WHITE });
}

function drawPageNotes(
  libPage: PDFPage,
  transform: PageTransform,
  notes: TakeoffExportDetail["notes"],
  fileId: string,
  firstFileId: string | null,
  pageNumber: number,
  font: PDFFont
) {
  for (const note of notes) {
    if (note.pageNumber !== pageNumber) continue;
    if ((note.takeoffFileId ?? firstFileId) !== fileId) continue;
    const p = transform.toPdfLibPoint({ x: note.x, y: note.y });
    const r = 6;
    libPage.drawCircle({ x: p.x, y: p.y, size: r, color: PLUM, borderColor: WHITE, borderWidth: 1.25 });
    libPage.drawText("!", { x: p.x - 1.3, y: p.y - 2.9, size: 8, font, color: WHITE });
    drawNoteCallout(libPage, { x: p.x + r + 3, y: p.y + r + 4 }, note.text, font);
  }
}

/** pdf-lib has no built-in text wrapping -- a small word-wrap helper, shared by the note callout and the footer disclaimer. */
function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A small white-backed callout box next to a note pin, with the note's own text wrapped to fit -- the vector equivalent of the on-screen note label (see measure-tool.tsx's plum-circle note rendering). */
function drawNoteCallout(page: PDFPage, anchor: MarkupPoint, text: string, font: PDFFont) {
  const size = 8;
  const maxWidth = 150;
  const lineHeight = size + 3;
  // Capped defensively -- a note is meant to be short; this just stops a
  // pasted essay from drawing an unreasonably tall box.
  const lines = wrapLines(text, font, size, maxWidth).slice(0, 6);
  const widestLine = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, size)), 20);
  const boxWidth = Math.min(maxWidth, widestLine) + 8;
  const boxHeight = lines.length * lineHeight + 6;
  const { x } = anchor;
  const y = anchor.y - boxHeight;
  page.drawRectangle({ x, y, width: boxWidth, height: boxHeight, color: WHITE, opacity: 0.9, borderColor: PLUM, borderWidth: 0.75 });
  lines.forEach((line, i) => {
    page.drawText(line, { x: x + 4, y: y + boxHeight - (i + 1) * lineHeight + 3, size, font, color: PLUM });
  });
}

/** A small white backing rectangle behind the label text, so it stays readable over any plan background -- the vector equivalent of the white paint-order stroke used on screen (see measure-tool.tsx's SVG <text>). */
function drawLabel(page: PDFPage, anchor: MarkupPoint, text: string, font: PDFFont, colour: RGB) {
  const size = 8;
  const padding = 2;
  const textWidth = font.widthOfTextAtSize(text, size);
  const textHeight = font.heightAtSize(size);
  const x = anchor.x + 4;
  const y = anchor.y + 4;
  page.drawRectangle({ x: x - padding, y: y - padding, width: textWidth + padding * 2, height: textHeight + padding * 2, color: WHITE, opacity: 0.85 });
  page.drawText(text, { x, y, size, font, color: colour });
}

// ---------------------------------------------------------------------------
// Branded summary page -- A4, matching quote-pdf.tsx's palette/margins
// ---------------------------------------------------------------------------

/** "Scale: 1:50" normally; if one or more files carry their own per-file scale override (Drawings Part 1 Step 4), names them rather than claiming a single ratio that wouldn't be true for the whole drawing. */
function scaleSummaryText(takeoff: TakeoffExportDetail): string {
  const base = takeoff.scaleRatioLabel ?? "Custom (calibrated)";
  const overridden = takeoff.files.filter((f) => f.pointsPerMetre != null);
  if (overridden.length === 0) return `Scale: ${base}`;
  return `Scale: ${base} (different scale set for: ${overridden.map((f) => f.name).join(", ")})`;
}

async function appendSummaryPage(libDoc: PDFDocument, takeoff: TakeoffExportDetail, files: ExportFileInput[], font: PDFFont, boldFont: PDFFont, showPrices: boolean) {
  const page = libDoc.addPage(A4);
  const [pageWidth, pageHeight] = A4;
  let y = pageHeight - MARGIN;

  // --- Header ---------------------------------------------------------
  try {
    const logoBytes = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
    const logoImage = await libDoc.embedPng(logoBytes);
    page.drawImage(logoImage, { x: MARGIN, y: y - 28, width: 28, height: 28 });
    page.drawText("PREMIER CLEAN & SEAL", { x: MARGIN + 36, y: y - 16, size: 11, font: boldFont, color: INK });
  } catch {
    page.drawText("PREMIER CLEAN & SEAL", { x: MARGIN, y: y - 10, size: 11, font: boldFont, color: INK });
  }

  const title = "Marked-up drawing";
  page.drawText(title, { x: pageWidth - MARGIN - boldFont.widthOfTextAtSize(title, 14), y: y - 14, size: 14, font: boldFont, color: PLUM });
  const dateLine = `Generated ${new Date().toLocaleDateString("en-GB")}`;
  page.drawText(dateLine, { x: pageWidth - MARGIN - font.widthOfTextAtSize(dateLine, 8), y: y - 28, size: 8, font, color: SLATE });
  y -= 48;

  // --- Drawing + customer + files/scale ----------------------------------
  page.drawText(takeoff.name, { x: MARGIN, y, size: 14, font: boldFont, color: INK });
  y -= 16;
  if (takeoff.customer) {
    const customerLine = takeoff.customer.company ? `${takeoff.customer.name} (${takeoff.customer.company})` : takeoff.customer.name;
    page.drawText(customerLine, { x: MARGIN, y, size: 10, font, color: SLATE });
    y -= 14;
  }
  page.drawText(`Files: ${files.map((f) => f.name).join(", ")}`, { x: MARGIN, y, size: 10, font, color: SLATE });
  y -= 14;
  page.drawText(scaleSummaryText(takeoff), { x: MARGIN, y, size: 10, font, color: SLATE });
  y -= 24;

  // --- Items table -------------------------------------------------------
  const colItem = MARGIN;
  const colQty = MARGIN + 260;
  const colRate = MARGIN + 340;
  const colLineTotal = pageWidth - MARGIN - 80;

  function drawTableHeader() {
    page.drawText("ITEM", { x: colItem, y, size: 8, font: boldFont, color: SLATE });
    page.drawText("QTY", { x: colQty, y, size: 8, font: boldFont, color: SLATE });
    if (showPrices) {
      page.drawText("RATE", { x: colRate, y, size: 8, font: boldFont, color: SLATE });
      page.drawText("LINE TOTAL", { x: colLineTotal, y, size: 8, font: boldFont, color: SLATE });
    }
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: pageWidth - MARGIN, y }, thickness: 1, color: PLUM });
    y -= 14;
  }
  drawTableHeader();

  for (const item of takeoff.items) {
    if (y < MARGIN + 60) {
      // Out of room on the summary page -- a measured drawing with this
      // many priced items is rare, and the full breakdown is always also
      // available back in the tool itself; stop listing rather than
      // overflow off the page.
      page.drawText("...", { x: colItem, y, size: 9, font, color: SLATE });
      y -= 14;
      break;
    }
    page.drawCircle({ x: colItem + 3, y: y + 3, size: 3, color: hexToRgb(item.colour) });
    page.drawText(item.name, { x: colItem + 12, y, size: 9, font, color: INK });
    // A COUNT item's quantity is a marker count, not a distance -- see
    // TakeoffItemDetail.count (Drawings Part 2).
    page.drawText(item.kind === "COUNT" ? `${item.count} x` : `${item.totalMetres} m`, { x: colQty, y, size: 9, font, color: INK });
    if (showPrices) {
      page.drawText(`${gbp(Number(item.pricePerMetre))}${item.kind === "COUNT" ? "/item" : "/m"}`, { x: colRate, y, size: 9, font, color: INK });
      page.drawText(gbp(item.lineTotalGbp), { x: colLineTotal, y, size: 9, font, color: INK });
    }
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: pageWidth - MARGIN, y }, thickness: 0.5, color: RULE });
    y -= 14;
  }

  y -= 6;
  page.drawText(`Total: ${takeoff.totalMetres} m`, { x: colQty, y, size: 10, font: boldFont, color: INK });
  if (showPrices) {
    const grandTotalText = gbp(takeoff.grandTotalGbp);
    page.drawText(grandTotalText, { x: colLineTotal, y, size: 11, font: boldFont, color: PLUM });
  }
  y -= 28;

  // --- Labelled measurements index ---------------------------------------
  const labelled = takeoff.items.flatMap((item) => item.measurements.filter((m) => m.label).map((m) => ({ item, m })));
  if (labelled.length > 0 && y > MARGIN + 60) {
    page.drawText("LABELLED MEASUREMENTS", { x: MARGIN, y, size: 8, font: boldFont, color: SLATE });
    y -= 14;
    for (const { item, m } of labelled) {
      if (y < MARGIN + 50) break;
      const fileName = files.find((f) => f.id === (m.takeoffFileId ?? files[0]?.id))?.name ?? "";
      const qty = item.kind === "COUNT" ? "1" : `${Number(m.computedMetres)}m`;
      page.drawText(`${item.name}: ${qty} - ${m.label} (${fileName}, page ${m.pageNumber})`, { x: MARGIN, y, size: 9, font, color: INK });
      y -= 13;
    }
    y -= 10;
  }

  // --- Footer --------------------------------------------------------
  const footerY = MARGIN + 30;
  page.drawLine({ start: { x: MARGIN, y: footerY + 14 }, end: { x: pageWidth - MARGIN, y: footerY + 14 }, thickness: 0.5, color: RULE });
  const disclaimer = "Measurements are approximate, taken from the supplied drawings at the stated scale.";
  drawWrappedText(page, disclaimer, MARGIN, footerY, pageWidth - MARGIN * 2, font, 8, SLATE);
}

/** pdf-lib has no built-in text wrapping -- a small word-wrap helper for the footer disclaimer, the only multi-line body text on the summary page. */
function drawWrappedText(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number, color: RGB) {
  const lines = wrapLines(text, font, size, maxWidth);
  let cursorY = y + 10;
  for (const l of lines) {
    page.drawText(l, { x, y: cursorY, size, font, color });
    cursorY -= size + 2;
  }
}

// ---------------------------------------------------------------------------
// Materials page -- worst-case tubes to BUY, an internal ordering sheet.
// Never shows a price and never affects the quote, which stays on measured
// metres (see the schema comment on TakeoffMaterialDefaults). Same maths
// and running-total convention as the on-screen MaterialsPanel.
// ---------------------------------------------------------------------------

function appendMaterialsPage(libDoc: PDFDocument, takeoff: TakeoffExportDetail, defaults: MaterialDefaultsValues, font: PDFFont, boldFont: PDFFont) {
  const page = libDoc.addPage(A4);
  const [pageWidth, pageHeight] = A4;
  let y = pageHeight - MARGIN;

  const title = "Materials (worst-case, for ordering)";
  page.drawText(title, { x: MARGIN, y, size: 14, font: boldFont, color: PLUM });
  y -= 20;
  page.drawText(takeoff.name, { x: MARGIN, y, size: 10, font, color: SLATE });
  y -= 24;

  const rows = takeoff.items
    .filter((i) => i.kind === "LENGTH" && i.totalMetres > 0)
    .map((item) => ({
      item,
      calc: calculateMaterialTubes(item.totalMetres, defaults, {
        jointWidthMm: item.overrideJointWidthMm,
        jointDepthMm: item.overrideJointDepthMm,
        wastePercent: item.overrideWastePercent,
      }),
    }));

  if (rows.length === 0) {
    page.drawText("No LENGTH items with any metres measured.", { x: MARGIN, y, size: 10, font, color: SLATE });
    return;
  }

  const colItem = MARGIN;
  const colMetres = MARGIN + 220;
  const colJoint = MARGIN + 300;
  const colTubes = pageWidth - MARGIN - 100;

  page.drawText("ITEM", { x: colItem, y, size: 8, font: boldFont, color: SLATE });
  page.drawText("METRES", { x: colMetres, y, size: 8, font: boldFont, color: SLATE });
  page.drawText("JOINT", { x: colJoint, y, size: 8, font: boldFont, color: SLATE });
  page.drawText("TUBES", { x: colTubes, y, size: 8, font: boldFont, color: SLATE });
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: pageWidth - MARGIN, y }, thickness: 1, color: PLUM });
  y -= 14;

  let totalTubes = 0;
  for (const { item, calc } of rows) {
    if (y < MARGIN + 60) {
      page.drawText("...", { x: colItem, y, size: 9, font, color: SLATE });
      y -= 14;
      break;
    }
    totalTubes += calc.tubesNeeded;
    page.drawCircle({ x: colItem + 3, y: y + 3, size: 3, color: hexToRgb(item.colour) });
    page.drawText(item.name, { x: colItem + 12, y, size: 9, font, color: INK });
    page.drawText(`${item.totalMetres} m`, { x: colMetres, y, size: 9, font, color: INK });
    page.drawText(`${calc.jointWidthMm}x${calc.jointDepthMm}mm`, { x: colJoint, y, size: 9, font, color: INK });
    page.drawText(`${calc.tubesNeeded} x ${calc.tubeMl}ml`, { x: colTubes, y, size: 9, font, color: INK });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: pageWidth - MARGIN, y }, thickness: 0.5, color: RULE });
    y -= 14;
  }

  y -= 6;
  page.drawText("Total tubes:", { x: colJoint, y, size: 10, font: boldFont, color: INK });
  page.drawText(String(totalTubes), { x: colTubes, y, size: 11, font: boldFont, color: PLUM });
  y -= 28;

  const disclaimer = "Worst-case estimate for ordering only -- always rounded up, never the quoted amount. The quote stays on measured metres.";
  drawWrappedText(page, disclaimer, MARGIN, y - 20, pageWidth - MARGIN * 2, font, 8, SLATE);
}
