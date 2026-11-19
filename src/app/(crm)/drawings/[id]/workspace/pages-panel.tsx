"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TakeoffItemDetail } from "@/services/takeoff.service";

const THUMB_WIDTH = 96;

/** One thumbnail -- renders itself (at a small fixed width, low resolution) the first time it scrolls into view, then never again. */
function PageThumbnail({ pdfDoc, pageNumber }: { pdfDoc: import("pdfjs-dist").PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    async function renderThumbnail() {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const natural = page.getViewport({ scale: 1 });
        const scale = THUMB_WIDTH / natural.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        // Leave the placeholder square -- not worth a dedicated error state for a thumbnail.
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !renderedRef.current) {
          renderedRef.current = true;
          renderThumbnail();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pdfDoc, pageNumber]);

  return (
    <div ref={containerRef} className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30">
      <canvas ref={canvasRef} className="max-h-full max-w-full" />
    </div>
  );
}

/**
 * Pages panel: a lazily-rendered thumbnail per page (only drawn once it has
 * actually scrolled into view, via IntersectionObserver -- never re-drawn
 * after that, even if it scrolls out and back), a measurement-count badge,
 * and click-to-jump. The current page is highlighted.
 */
export function PagesPanel({
  pdfDoc,
  numPages,
  currentPage,
  onJump,
  items,
  activeFileId,
  firstFileId,
}: {
  pdfDoc: import("pdfjs-dist").PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  onJump: (page: number) => void;
  items: TakeoffItemDetail[];
  /** Counts only measurements on the ACTIVE file -- a null takeoffFileId means "the first file" (same convention as everywhere else), so different files sharing the same page numbers never get their counts merged. */
  activeFileId: string;
  firstFileId: string | undefined;
}) {
  const counts = new Map<number, number>();
  for (const item of items) {
    for (const m of item.measurements) {
      if ((m.takeoffFileId ?? firstFileId) !== activeFileId) continue;
      counts.set(m.pageNumber, (counts.get(m.pageNumber) ?? 0) + 1);
    }
  }

  return (
    <ul className="space-y-1">
      {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
        <li key={page}>
          <button
            type="button"
            onClick={() => onJump(page)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md border p-1.5 text-left text-xs",
              page === currentPage ? "border-brand-plum bg-brand-plum-soft font-medium" : "hover:bg-accent"
            )}
          >
            {pdfDoc ? <PageThumbnail pdfDoc={pdfDoc} pageNumber={page} /> : <div className="h-16 w-14 shrink-0 rounded border bg-muted/30" />}
            <span className="flex-1">Page {page}</span>
            {counts.has(page) && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{counts.get(page)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
