"use client";

import type { ActiveTool } from "./types";

const TOOL_HINTS: Record<ActiveTool, string> = {
  select: "Select, drag to pan, or pick a tool on the left to start measuring.",
  length: "Click to start a length, click again to finish -- Ctrl+click to start a chain -- Esc to cancel.",
  calibrate: "Click two points over a feature of known length, then enter its real length.",
  count: "Click to drop a count marker for the selected item.",
  note: "Click to drop a note, then type it.",
  erase: "Click a measurement, marker or note to delete it.",
};

const SNAP_LABELS = { endpoint: "Endpoint", intersection: "Intersection", line: "On line" } as const;

export function StatusBar({
  activeTool,
  drawingMetres,
  scaleLabel,
  cursor,
  zoomPercent,
  shiftLocked,
  snapType,
}: {
  activeTool: ActiveTool;
  drawingMetres: number | null;
  scaleLabel: string;
  cursor: { x: number; y: number } | null;
  zoomPercent: number;
  shiftLocked?: boolean;
  snapType?: "endpoint" | "intersection" | "line" | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-b-lg border-t bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="flex-1">{TOOL_HINTS[activeTool]}</span>
      {shiftLocked && <span className="font-medium text-brand-plum">0/45/90 lock</span>}
      {!shiftLocked && snapType && <span className="font-medium text-green-700">{SNAP_LABELS[snapType]}</span>}
      {drawingMetres != null && <span className="font-medium text-foreground">Drawing: {drawingMetres.toFixed(2)} m</span>}
      <span>Scale {scaleLabel}</span>
      <span>{cursor ? `${Math.round(cursor.x)}, ${Math.round(cursor.y)}` : "--"}</span>
      <span>{Math.round(zoomPercent)}%</span>
    </div>
  );
}
