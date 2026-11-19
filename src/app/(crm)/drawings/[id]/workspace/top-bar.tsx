"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, ScanLine, MoveHorizontal, RotateCw, Pencil, Check, X, Plus, ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FileTab = { id: string; name: string };

/**
 * Top bar: drawing name (editable), file tabs (Drawings Part 1 Step 4 --
 * add/rename/reorder/remove), page nav, zoom, fit controls, rotate view,
 * and a full-screen toggle.
 */
export function TopBar({
  name,
  onRename,
  files,
  activeFileId,
  onSelectFile,
  onAddFile,
  onRenameFile,
  onMoveFile,
  onRemoveFile,
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
  onAddFile: () => void;
  onRenameFile: (fileId: string, name: string) => void;
  onMoveFile: (fileId: string, direction: "up" | "down") => void;
  onRemoveFile: (fileId: string) => void;
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
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [fileNameDraft, setFileNameDraft] = useState("");
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

      <div className="flex flex-wrap items-center gap-1">
        {files.map((f, i) =>
          editingFileId === f.id ? (
            <div key={f.id} className="flex items-center gap-1 rounded-t-md border-x border-t bg-muted/40 px-1.5 py-1">
              <Input
                autoFocus
                value={fileNameDraft}
                onChange={(e) => setFileNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRenameFile(f.id, fileNameDraft.trim() || f.name);
                    setEditingFileId(null);
                  }
                  if (e.key === "Escape") setEditingFileId(null);
                }}
                className="h-6 w-28 text-xs"
              />
              <button type="button" onClick={() => { onRenameFile(f.id, fileNameDraft.trim() || f.name); setEditingFileId(null); }} aria-label="Save file name">
                <Check className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => setEditingFileId(null)} aria-label="Cancel rename">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div
              key={f.id}
              className={`group flex items-center gap-1 rounded-t-md border-x border-t px-2 py-1 text-xs font-medium ${f.id === activeFileId ? "bg-brand-plum-soft text-brand-plum" : "bg-muted/40 text-muted-foreground hover:bg-accent"}`}
            >
              <button type="button" onClick={() => onSelectFile(f.id)}>{f.name}</button>
              {f.id === activeFileId && (
                <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button type="button" onClick={() => { setFileNameDraft(f.name); setEditingFileId(f.id); }} aria-label={`Rename ${f.name}`}>
                    <Pencil className="h-3 w-3" />
                  </button>
                  {i > 0 && (
                    <button type="button" onClick={() => onMoveFile(f.id, "up")} aria-label={`Move ${f.name} earlier`}>
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                  )}
                  {i < files.length - 1 && (
                    <button type="button" onClick={() => onMoveFile(f.id, "down")} aria-label={`Move ${f.name} later`}>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                  <button type="button" onClick={() => onRemoveFile(f.id)} aria-label={`Remove ${f.name}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )
        )}
        <button type="button" onClick={onAddFile} className="flex items-center gap-1 rounded-t-md border-x border-t border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-accent" title="Add another file to this drawing">
          <Plus className="h-3 w-3" /> Add file
        </button>
      </div>
    </div>
  );
}
