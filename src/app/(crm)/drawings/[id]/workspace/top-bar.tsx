"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, ScanLine, MoveHorizontal, RotateCw, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FileTab = { id: string; name: string };

/**
 * Top bar: drawing name (editable), file tabs (a single tab until Step 4
 * adds more than one file per drawing -- the tab bar is already built to
 * take an arbitrary list), page nav, zoom, fit controls, rotate view, and
 * a full-screen toggle.
 */
export function TopBar({
  name,
  onRename,
  files,
  activeFileId,
  onSelectFile,
  currentPage,
  numPages,
  onPrevPage,
  onNextPage,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFitPage,
  onFitWidth,
  onRotate,
  fullScreen,
  onToggleFullScreen,
}: {
  name: string;
  onRename: (name: string) => void;
  files: FileTab[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  currentPage: number;
  numPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onRotate: () => void;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);

  function commitName() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setEditingName(false);
  }

  return (
    <div className="space-y-1.5 rounded-t-lg border bg-card p-2">
      <div className="flex flex-wrap items-center gap-2">
        {editingName ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="h-8 w-56 text-sm font-medium"
            />
            <Button type="button" size="sm" variant="ghost" onClick={commitName} aria-label="Save name"><Check className="h-3.5 w-3.5" /></Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingName(false)} aria-label="Cancel rename"><X className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(name);
              setEditingName(true);
            }}
            className="group flex items-center gap-1.5 rounded px-1.5 py-1 text-sm font-semibold hover:bg-accent"
          >
            {name}
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </button>
        )}

        <div className="mx-1 h-5 w-px bg-border" />

        <Button type="button" size="sm" variant="outline" onClick={onPrevPage} disabled={currentPage <= 1} aria-label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs">Page {currentPage} of {numPages}</span>
        <Button type="button" size="sm" variant="outline" onClick={onNextPage} disabled={currentPage >= numPages} aria-label="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button type="button" size="sm" variant="outline" onClick={onZoomOut} aria-label="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></Button>
        <span className="w-10 text-center text-xs">{Math.round(zoomPercent)}%</span>
        <Button type="button" size="sm" variant="outline" onClick={onZoomIn} aria-label="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="sm" variant="outline" onClick={onFitPage} title="Fit page (1)"><ScanLine className="h-3.5 w-3.5" /> Fit page</Button>
        <Button type="button" size="sm" variant="outline" onClick={onFitWidth} title="Fit width (2)"><MoveHorizontal className="h-3.5 w-3.5" /> Fit width</Button>
        <Button type="button" size="sm" variant="outline" onClick={onRotate} title="Rotate view 90 degrees (R)" aria-label="Rotate view"><RotateCw className="h-3.5 w-3.5" /></Button>

        <div className="ml-auto">
          <Button type="button" size="sm" variant="outline" onClick={onToggleFullScreen} aria-label={fullScreen ? "Exit full screen" : "Enter full screen"}>
            {fullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {files.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectFile(f.id)}
              className={`rounded-t-md border-x border-t px-3 py-1 text-xs font-medium ${f.id === activeFileId ? "bg-brand-plum-soft text-brand-plum" : "bg-muted/40 text-muted-foreground hover:bg-accent"}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
