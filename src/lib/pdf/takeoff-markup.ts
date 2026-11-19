import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { openPdfForTransforms, type PageTransform, type MarkupPoint } from "./takeoff-markup-transform";
import type { TakeoffExportDetail } from "@/services/takeoff.service";

// Generates the marked-up plan PDF for the "Measuring tool, Phase 2" export
// (GET /api/takeoffs/[id]/export). Draws vector lines/labels straight onto
// the ORIGINAL plan's own pages (quality is preserved at any zoom, unlike a
// rasterised screenshot), then appends one branded summary page, matching
// the look of quote-pdf.tsx as closely as pdf-lib's lower-level drawing API
// allows (that file uses @react-pdf/renderer's layout engine; this one
// draws absolute x/y, since it also has to draw onto pre-existing pages).
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

export type ExportOptions = { showPrices: boolean; pages: "measured" | "all" };

/**
 * sourceBytes is read twice here (once by pdf-lib's PDFDocument.load, once
 * by openPdfForTransforms -- which internally .slice()s its own copy, see
 * that module's comment on buffer transfer/detachment), so the caller's
 * buffer is safe to pass to both without any extra copying of its own.
 */
export async function generateMarkupPdf(sourceBytes: Uint8Array, takeoff: TakeoffExportDetail, options: ExportOptions): Promise<Buffer> {
  const libDoc = await PDFDocument.load(sourceBytes);
  const labelFont = await libDoc.embedFont(StandardFonts.Helvetica);

  const pagesWithMeasurements = new Set<number>();
  for (const item of takeoff.items) for (const m of item.measurements) pagesWithMeasurements.add(m.pageNumber);

  if (pagesWithMeasurements.size > 0) {
    const { getPageTransform, destroy } = await openPdfForTransforms(sourceBytes);
    try {
      for (const pageNumber of Array.from(pagesWithMeasurements)) {
        // Defensive: a measurement's page could in principle outlive the
        // source PDF it referred to (e.g. a re-uploaded, shorter file) --
        // skip rather than throw.
        if (pageNumber < 1 || pageNumber > libDoc.getPageCount()) continue;
        const transform = await getPageTransform(pageNumber);
        drawPageMeasurements(libDoc.getPage(pageNumber - 1), transform, takeoff.items, pageNumber, labelFont);
      }
    } finally {
      await destroy();
    }
  }

  if (options.pages === "measured") {
    for (let i = libDoc.getPageCount() - 1; i >= 0; i--) {
      if (!pagesWithMeasurements.has(i + 1)) libDoc.removePage(i);
    }
  }

  const bodyFont = await libDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await libDoc.embedFont(StandardFonts.HelveticaBold);
  await appendSummaryPage(libDoc, takeoff, bodyFont, boldFont, options.showPrices);

  const outBytes = await libDoc.save();
  return Buffer.from(outBytes);
}

// ---------------------------------------------------------------------------
// On-plan markup
// ---------------------------------------------------------------------------

function drawPageMeasurements(
  libPage: PDFPage,
  transform: PageTransform,
  items: TakeoffExportDetail["items"],
  pageNumber: number,
  font: PDFFont
) {
  for (const item of items) {
    const colour = hexToRgb(item.colour);
    for (const m of item.measurements) {
      if (m.pageNumber !== pageNumber) continue;
      const pdfPoints = m.points.map((p) => transform.toPdfLibPoint(p));

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

async function appendSummaryPage(libDoc: PDFDocument, takeoff: TakeoffExportDetail, font: PDFFont, boldFont: PDFFont, showPrices: boolean) {
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

  const title = "Measured plan";
  page.drawText(title, { x: pageWidth - MARGIN - boldFont.widthOfTextAtSize(title, 14), y: y - 14, size: 14, font: boldFont, color: PLUM });
  const dateLine = `Generated ${new Date().toLocaleDateString("en-GB")}`;
  page.drawText(dateLine, { x: pageWidth - MARGIN - font.widthOfTextAtSize(dateLine, 8), y: y - 28, size: 8, font, color: SLATE });
  y -= 48;

  // --- Takeoff + customer ----------------------------------------------
  page.drawText(takeoff.name, { x: MARGIN, y, size: 14, font: boldFont, color: INK });
  y -= 16;
  if (takeoff.customer) {
    const customerLine = takeoff.customer.company ? `${takeoff.customer.name} (${takeoff.customer.company})` : takeoff.customer.name;
    page.drawText(customerLine, { x: MARGIN, y, size: 10, font, color: SLATE });
    y -= 14;
  }
  page.drawText(`Scale: ${takeoff.scaleRatioLabel ?? "Custom (calibrated)"}`, { x: MARGIN, y, size: 10, font, color: SLATE });
  y -= 24;

  // --- Items table -------------------------------------------------------
  const colItem = MARGIN;
  const colMetres = MARGIN + 260;
  const colRate = MARGIN + 340;
  const colLineTotal = pageWidth - MARGIN - 80;

  function drawTableHeader() {
    page.drawText("ITEM", { x: colItem, y, size: 8, font: boldFont, color: SLATE });
    page.drawText("METRES", { x: colMetres, y, size: 8, font: boldFont, color: SLATE });
    if (showPrices) {
      page.drawText("GBP/M", { x: colRate, y, size: 8, font: boldFont, color: SLATE });
      page.drawText("LINE TOTAL", { x: colLineTotal, y, size: 8, font: boldFont, color: SLATE });
    }
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: pageWidth - MARGIN, y }, thickness: 1, color: PLUM });
    y -= 14;
  }
  drawTableHeader();

  for (const item of takeoff.items) {
    if (y < MARGIN + 60) {
      // Out of room on the summary page -- a measured takeoff with this
      // many priced items is rare, and the full breakdown is always also
      // available back in the tool itself; stop listing rather than
      // overflow off the page.
      page.drawText("...", { x: colItem, y, size: 9, font, color: SLATE });
      y -= 14;
      break;
    }
    page.drawCircle({ x: colItem + 3, y: y + 3, size: 3, color: hexToRgb(item.colour) });
    page.drawText(item.name, { x: colItem + 12, y, size: 9, font, color: INK });
    page.drawText(`${item.totalMetres}`, { x: colMetres, y, size: 9, font, color: INK });
    if (showPrices) {
      page.drawText(gbp(Number(item.pricePerMetre)), { x: colRate, y, size: 9, font, color: INK });
      page.drawText(gbp(item.lineTotalGbp), { x: colLineTotal, y, size: 9, font, color: INK });
    }
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: pageWidth - MARGIN, y }, thickness: 0.5, color: RULE });
    y -= 14;
  }

  y -= 6;
  page.drawText(`Total: ${takeoff.totalMetres} m`, { x: colMetres, y, size: 10, font: boldFont, color: INK });
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
      page.drawText(`${item.name}: ${Number(m.computedMetres)}m - ${m.label} (page ${m.pageNumber})`, { x: MARGIN, y, size: 9, font, color: INK });
      y -= 13;
    }
    y -= 10;
  }

  // --- Footer --------------------------------------------------------
  const footerY = MARGIN + 30;
  page.drawLine({ start: { x: MARGIN, y: footerY + 14 }, end: { x: pageWidth - MARGIN, y: footerY + 14 }, thickness: 0.5, color: RULE });
  const disclaimer =
    "Measurements are taken off the attached plan at the scale shown and are approximate. Please confirm critical dimensions on site before ordering materials.";
  drawWrappedText(page, disclaimer, MARGIN, footerY, pageWidth - MARGIN * 2, font, 8, SLATE);
}

/** pdf-lib has no built-in text wrapping -- a small word-wrap helper for the footer disclaimer, the only multi-line body text on this page. */
function drawWrappedText(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number, color: RGB) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y + 10;
  const lines: string[] = [];
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
  for (const l of lines) {
    page.drawText(l, { x, y: cursorY, size, font, color });
    cursorY -= size + 2;
  }
}
