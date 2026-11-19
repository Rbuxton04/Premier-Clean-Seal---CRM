"use client";

import { Search, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchResult = { fileId: string; fileName: string; pageNumber: number; snippet: string };

/**
 * Search panel: searches every page of every file in the drawing (via
 * pdf.js getTextContent, indexed lazily and cached per page -- see
 * measure-tool.tsx's indexFileForSearch/runSearch). This component is
 * pure presentation; all the indexing/searching state lives in
 * measure-tool.tsx so it can also drive the on-plan highlight.
 */
export function SearchPanel({
  query,
  onQueryChange,
  searching,
  results,
  activeResultIndex,
  noSearchableText,
  onJumpToResult,
  onNext,
  onPrevious,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  searching: boolean;
  results: SearchResult[];
  activeResultIndex: number;
  noSearchableText: boolean;
  onJumpToResult: (result: SearchResult, index: number) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrevious();
      else onNext();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search text in this drawing"
            className="h-8 pl-7 text-sm"
          />
        </div>
        <button type="button" onClick={onPrevious} disabled={results.length === 0} className="rounded border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30" title="Previous (Shift+Enter)" aria-label="Previous result">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onNext} disabled={results.length === 0} className="rounded border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30" title="Next (Enter)" aria-label="Next result">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {searching && <p className="text-xs text-muted-foreground">Searching…</p>}

      {!searching && query.trim() && noSearchableText && (
        <p className="text-xs text-muted-foreground">No searchable text in this drawing -- it looks like a scanned/image-only PDF.</p>
      )}

      {!searching && query.trim() && !noSearchableText && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No matches for &quot;{query}&quot;.</p>
      )}

      {results.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{results.length} match{results.length === 1 ? "" : "es"}</p>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {results.map((r, i) => (
              <li key={`${r.fileId}-${r.pageNumber}-${i}`}>
                <button
                  type="button"
                  onClick={() => onJumpToResult(r, i)}
                  className={cn(
                    "w-full rounded-md border p-1.5 text-left text-xs",
                    i === activeResultIndex ? "border-brand-plum bg-brand-plum-soft" : "hover:bg-accent"
                  )}
                >
                  <span className="font-medium">{r.fileName}, page {r.pageNumber}</span>
                  <br />
                  <span className="text-muted-foreground">…{r.snippet}…</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
