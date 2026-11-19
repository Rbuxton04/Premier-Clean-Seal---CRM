// Converts a measurement point from pdf.js "device space" (top-left
// origin, y-down, at viewport scale=1 -- exactly how the measuring tool
// stores TakeoffMeasurement.points; see the scale-math comment block at
// the top of validators/takeoff.ts) into pdf-lib's drawing space for that
// same page.
//
// Why this is needed: pdf-lib's PDFPage.drawLine/drawCircle/drawText draw
// in the page's own PDF "user space" -- bottom-left-ish origin, y-up,
// defined relative to the page's MediaBox, and NOT automatically adjusted
// for the page's own /Rotate entry (that entry is a viewer-side display
// instruction; it does not move where content-stream coordinates land).
// pdf.js's device space, by contrast, already bakes in BOTH the page's
// /Rotate and any CropBox offset, because that is what makes its device
// coordinates match what a user visually sees (and clicks) on screen.
//
// Rather than re-deriving that rotation/offset matrix by hand (error-prone
// to get right for all four rotation values plus an arbitrary CropBox),
// this re-uses pdf.js itself -- the exact library that produced the
// device-space points in the first place -- via the PageViewport class's
// own convertToPdfPoint() method, which is pdf.js's documented inverse of
// the same transform it uses to lay out rendering. See
// scripts/check-takeoff-markup-transform.mjs for the standalone proof
// (normal / rotated / CropBox-offset pages) that this round-trips
// correctly.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type MarkupPoint = { x: number; y: number };

export type PageTransform = {
  /** pdf.js device-space point (as stored on a measurement) -> pdf-lib drawing-space point for this page. */
  toPdfLibPoint: (p: MarkupPoint) => MarkupPoint;
  /** This page's device-space size at scale=1 -- i.e. the width/height the stored points are relative to. */
  deviceWidth: number;
  deviceHeight: number;
};

/**
 * Opens a PDF once (via pdf.js, geometry only -- render() is never called,
 * so no canvas/DOM polyfill is needed) and hands back a per-page
 * transform getter. The export route opens the source PDF exactly once
 * and calls getPageTransform() for each page it marks up, rather than
 * re-parsing the whole document per page.
 */
export async function openPdfForTransforms(pdfBytes: Uint8Array): Promise<{
  getPageTransform: (pageNumber: number) => Promise<PageTransform>;
  numPages: number;
  destroy: () => Promise<void>;
}> {
  // pdf.js's Node "fake worker" transfers (and so detaches) the
  // ArrayBuffer backing `data` when it hands the bytes across its
  // internal postMessage-style boundary -- even in this same-thread
  // fallback. Handing it the caller's own buffer would leave that buffer
  // unusable afterwards for anything else (e.g. pdf-lib's PDFDocument.load
  // on the same source bytes in the export route) -- .slice() gives pdf.js
  // a disposable copy to detach instead.
  const doc = await getDocument({ data: pdfBytes.slice(), isEvalSupported: false, useSystemFonts: true }).promise;
  return {
    numPages: doc.numPages,
    getPageTransform: async (pageNumber: number) => {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      return {
        toPdfLibPoint: (p: MarkupPoint) => {
          const [x, y] = viewport.convertToPdfPoint(p.x, p.y);
          return { x, y };
        },
        deviceWidth: viewport.width,
        deviceHeight: viewport.height,
      };
    },
    destroy: () => doc.destroy(),
  };
}

/** Convenience single-page wrapper, used by the standalone proof script. */
export async function buildPageTransform(pdfBytes: Uint8Array, pageNumber: number): Promise<PageTransform> {
  const { getPageTransform, destroy } = await openPdfForTransforms(pdfBytes);
  try {
    return await getPageTransform(pageNumber);
  } finally {
    await destroy();
  }
}
