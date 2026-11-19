"use client";

import { MousePointer2, Ruler, Link2, Crosshair, Hash, StickyNote, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveTool } from "./types";

type ToolDef = { id: ActiveTool; label: string; shortcut: string; icon: typeof MousePointer2; disabled?: boolean };

const TOOLS: ToolDef[] = [
  { id: "select", label: "Select / Pan", shortcut: "S", icon: MousePointer2 },
  { id: "length", label: "Length", shortcut: "L", icon: Ruler },
  { id: "chain", label: "Chain", shortcut: "C", icon: Link2 },
  { id: "calibrate", label: "Calibrate", shortcut: "K", icon: Crosshair },
];

const PLACEHOLDER_TOOLS: { label: string; icon: typeof Hash }[] = [
  { label: "Count (coming soon)", icon: Hash },
  { label: "Note (coming soon)", icon: StickyNote },
  { label: "Erase (coming soon)", icon: Eraser },
];

/** Vertical left-hand tool palette -- SketchUp-style single-select active tool, replacing the old independent "Chain mode"/Ctrl+click toggle. */
export function ToolPalette({ activeTool, onSelectTool, orientation = "vertical" }: { activeTool: ActiveTool; onSelectTool: (tool: ActiveTool) => void; orientation?: "vertical" | "horizontal" }) {
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
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              active ? "bg-brand-plum text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
      <div className={orientation === "vertical" ? "my-1 h-px w-full bg-border" : "mx-1 h-full w-px bg-border"} />
      {PLACEHOLDER_TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.label}
            type="button"
            disabled
            title={tool.label}
            aria-label={tool.label}
            className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/40"
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
