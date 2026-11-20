"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { ToolPalette } from "./tool-palette";
import type { ActiveTool } from "./types";
import type { PanelId, WorkspaceLayout } from "./use-workspace-layout";

/**
 * Small-screen replacement for the desktop tool palette + tray: a fixed
 * bottom toolbar (tools, horizontal) plus a "Panels" pull-up sheet listing
 * the same six panels as a plain collapse/expand accordion -- no
 * drag-reorder, no floating/pop-out, per the brief ("floating panels are
 * disabled" on small screens). Shares the same per-panel collapsed state
 * as the desktop tray (via the same layout hook) so toggling one updates
 * the other if the viewport is resized across the breakpoint.
 */
export function MobileWorkspaceBar({
  activeTool,
  onSelectTool,
  layout,
  onToggleCollapsed,
  panelTitles,
  panelContent,
}: {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  layout: WorkspaceLayout;
  onToggleCollapsed: (id: PanelId) => void;
  panelTitles: Record<PanelId, string>;
  panelContent: Record<PanelId, ReactNode>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-x-0 bottom-14 z-30 max-h-[60vh] overflow-y-auto rounded-t-xl border-t bg-card p-2 shadow-2xl">
          {layout.panelOrder.map((id) => (
            <div key={id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => onToggleCollapsed(id)}
                className="flex min-h-11 w-full items-center justify-between py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                aria-expanded={!layout.panels[id].collapsed}
              >
                {panelTitles[id]}
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${layout.panels[id].collapsed ? "" : "rotate-90"}`} />
              </button>
              {!layout.panels[id].collapsed && <div className="pb-2">{panelContent[id]}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-card px-2 py-1.5">
        <ToolPalette activeTool={activeTool} onSelectTool={onSelectTool} orientation="horizontal" size="touch" />
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          className="ml-auto flex h-11 items-center gap-1 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          Panels {sheetOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
    </>
  );
}
