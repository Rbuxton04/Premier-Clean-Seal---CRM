"use client";

import { cn } from "@/lib/utils";
import type { TakeoffItemDetail } from "@/services/takeoff.service";

/**
 * MVP of the brief's Pages panel: a numbered list with a measurement-count
 * badge and click-to-jump. Lazily-rendered bitmap thumbnails are Step 3's
 * explicit scope (it owns the render/zoom pipeline this needs) -- built as
 * its own component so Step 3 can swap the list item's content for a
 * thumbnail without touching anything else here.
 */
export function PagesPanel({
  numPages,
  currentPage,
  onJump,
  items,
}: {
  numPages: number;
  currentPage: number;
  onJump: (page: number) => void;
  items: TakeoffItemDetail[];
}) {
  const counts = new Map<number, number>();
  for (const item of items) {
    for (const m of item.measurements) counts.set(m.pageNumber, (counts.get(m.pageNumber) ?? 0) + 1);
  }

  return (
    <ul className="space-y-1">
      {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
        <li key={page}>
          <button
            type="button"
            onClick={() => onJump(page)}
            className={cn(
              "flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs",
              page === currentPage ? "border-brand-plum bg-brand-plum-soft font-medium" : "hover:bg-accent"
            )}
          >
            <span>Page {page}</span>
            {counts.has(page) && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{counts.get(page)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
