"use client";

import type { ActiveTool } from "./types";

const TOOL_HINTS: Record<ActiveTool, string> = {
  select: "Select an item, or pick a tool on the left to start measuring.",
  length: "Click to start a length, click again to finish -- Esc to cancel.",
  chain: "Click to add each point of a chain -- double-click, Enter, or Esc to finish.",
  calibrate: "Click two points over a feature of known length, then enter its real length.",
};

export function StatusBar({
  activeTool,
  drawingMetres,
  scaleLabel,
  cursor,
  zoomPercent,
}: {
  activeTool: ActiveTool;
  drawingMetres: number | null;
  scaleLabel: string;
  cursor: { x: number; y: number } | null;
  zoomPercent: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-b-lg border-t bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="flex-1">{TOOL_HINTS[activeTool]}</span>
      {drawingMetres != null && <span className="font-medium text-foreground">Drawing: {drawingMetres.toFixed(2)} m</span>}
      <span>Scale {scaleLabel}</span>
      <span>{cursor ? `${Math.round(cursor.x)}, ${Math.round(cursor.y)}` : "--"}</span>
      <span>{Math.round(zoomPercent)}%</span>
    </div>
  );
}
