"use client";

import { MousePointer2, Ruler, Crosshair, Hash, StickyNote, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveTool } from "./types";

type ToolDef = { id: ActiveTool; label: string; shortcut: string; icon: typeof MousePointer2 };

const TOOLS: ToolDef[] = [
  { id: "select", label: "Select / Pan", shortcut: "V", icon: MousePointer2 },
  { id: "length", label: "Length (Ctrl+click for a chain)", shortcut: "L", icon: Ruler },
  { id: "count", label: "Count", shortcut: "C", icon: Hash },
  { id: "note", label: "Note", shortcut: "N", icon: StickyNote },
  { id: "calibrate", label: "Calibrate", shortcut: "K", icon: Crosshair },
  { id: "erase", label: "Erase", shortcut: "E", icon: Eraser },
];

/** Vertical left-hand tool palette -- SketchUp-style single-select active tool. size="touch" (used by the mobile bottom bar) bumps each button to a full 44px tap target, per Apple/WCAG touch-target guidance -- the desktop palette stays compact since a mouse doesn't need it. */
export function ToolPalette({
  activeTool,
  onSelectTool,
  orientation = "vertical",
  size = "default",
}: {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  orientation?: "vertical" | "horizontal";
  size?: "default" | "touch";
}) {
  return (
    <div className={cn("flex gap-1 rounded-lg border bg-card p-1.5", orientation === "vertical" ? "flex-col" : "flex-row")}>
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const active = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onSelectTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            aria-pressed={active}
            aria-label={tool.label}
            className={cn(
              "flex items-center justify-center rounded-md transition-colors",
              size === "touch" ? "h-11 w-11" : "h-9 w-9",
              active ? "bg-brand-plum text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className={size === "touch" ? "h-5 w-5" : "h-4 w-4"} />
          </button>
        );
      })}
    </div>
  );
}
