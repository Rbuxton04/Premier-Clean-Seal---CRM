"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Point } from "@/validators/takeoff";

export type MeasurementRow = {
  key: string;
  group: "item" | "note";
  itemId?: string;
  itemName?: string;
  itemColour?: string;
  measurementId?: string;
  noteId?: string;
  fileId: string | null;
  fileName: string;
  pageNumber: number;
  label: string | null;
  point: Point;
  sizeText: string;
  sortSize: number;
};

type SortKey = "page" | "size";

/**
 * Measurements list (Drawings Part 2, section 5) -- every measurement,
 * count marker and note, grouped by item (notes get their own group),
 * sortable by page or size within each group, filterable by label text
 * and/or "this page only". Clicking a row jumps to it (see
 * measure-tool.tsx's jumpToRow); hovering highlights it on the canvas.
 */
export function MeasurementsListPanel({
  rows,
  currentPage,
  onJump,
  onHoverRow,
}: {
  rows: MeasurementRow[];
  currentPage: number;
  onJump: (row: MeasurementRow) => void;
  onHoverRow: (key: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [thisPageOnly, setThisPageOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("page");

  const groups = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (thisPageOnly && r.pageNumber !== currentPage) return false;
      if (query.trim() && !(r.label ?? "").toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
    const byGroup = new Map<string, MeasurementRow[]>();
    for (const row of filtered) {
      const groupName = row.group === "note" ? "Notes" : row.itemName ?? "Item";
      if (!byGroup.has(groupName)) byGroup.set(groupName, []);
      byGroup.get(groupName)!.push(row);
    }
    for (const list of Array.from(byGroup.values())) {
      list.sort((a: MeasurementRow, b: MeasurementRow) => (sortKey === "page" ? a.pageNumber - b.pageNumber : b.sortSize - a.sortSize));
    }
    return byGroup;
  }, [rows, query, thisPageOnly, sortKey, currentPage]);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No measurements, markers or notes yet.</p>;
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by label" className="h-8 pl-7 text-xs" />
        </div>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="h-8 w-24 text-xs">
          <option value="page">By page</option>
          <option value="size">By size</option>
        </Select>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={thisPageOnly} onChange={(e) => setThisPageOnly(e.target.checked)} /> This page only
      </label>

      <div className="max-h-80 space-y-3 overflow-y-auto">
        {Array.from(groups.entries()).map(([groupName, groupRows]) => (
          <div key={groupName}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{groupName}</h4>
            <ul className="space-y-1">
              {groupRows.map((row) => (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => onJump(row)}
                    onMouseEnter={() => onHoverRow(row.key)}
                    onMouseLeave={() => onHoverRow(null)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border p-1.5 text-left text-xs hover:bg-accent",
                      row.pageNumber === currentPage && "border-brand-plum/40"
                    )}
                  >
                    {row.itemColour && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.itemColour }} />}
                    <span className="flex-1 truncate">{row.label || (row.group === "note" ? "(empty note)" : "(unlabelled)")}</span>
                    <span className="text-muted-foreground">{row.sizeText}</span>
                    <span className="text-muted-foreground">{row.fileName} p{row.pageNumber}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
