"use client";

import { useRef, type ReactNode } from "react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { ChevronsLeft, ChevronsRight, RotateCcw } from "lucide-react";
import { DockedPanel, FloatingPanel } from "./panel";
import type { PanelId, WorkspaceLayout } from "./use-workspace-layout";

export function WorkspaceTray({
  layout,
  onToggleCollapsed,
  onPopOut,
  onDock,
  onMove,
  onReorder,
  onToggleTrayCollapsed,
  onResizeTray,
  onResetLayout,
  panelTitles,
  panelContent,
}: {
  layout: WorkspaceLayout;
  onToggleCollapsed: (id: PanelId) => void;
  onPopOut: (id: PanelId) => void;
  onDock: (id: PanelId) => void;
  onMove: (id: PanelId, x: number, y: number) => void;
  onReorder: (order: PanelId[]) => void;
  onToggleTrayCollapsed: () => void;
  onResizeTray: (width: number) => void;
  onResetLayout: () => void;
  panelTitles: Record<PanelId, string>;
  panelContent: Record<PanelId, ReactNode>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const resizeState = useRef<{ startX: number; startWidth: number } | null>(null);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = layout.panelOrder.indexOf(active.id as PanelId);
    const newIndex = layout.panelOrder.indexOf(over.id as PanelId);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(layout.panelOrder, oldIndex, newIndex));
  }

  function startResize(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeState.current = { startX: e.clientX, startWidth: layout.trayWidth };
  }
  function onResize(e: React.PointerEvent) {
    if (!resizeState.current) return;
    const { startX, startWidth } = resizeState.current;
    onResizeTray(startWidth - (e.clientX - startX));
  }
  function endResize() {
    resizeState.current = null;
  }

  const dockedIds = layout.panelOrder.filter((id) => !layout.panels[id].floating);
  const floatingIds = layout.panelOrder.filter((id) => layout.panels[id].floating);

  if (layout.trayCollapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg border bg-card p-1.5">
        <button type="button" onClick={onToggleTrayCollapsed} className="text-muted-foreground hover:text-foreground" aria-label="Expand tray" title="Expand tray">
          <ChevronsLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative flex shrink-0 flex-col gap-2" style={{ width: layout.trayWidth }}>
        <div
          onPointerDown={startResize}
          onPointerMove={onResize}
          onPointerUp={endResize}
          className="absolute -left-1.5 top-0 h-full w-3 cursor-col-resize touch-none"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel tray"
        />
        <div className="flex items-center justify-between px-1">
          <button type="button" onClick={onToggleTrayCollapsed} className="text-muted-foreground hover:text-foreground" aria-label="Collapse tray" title="Collapse tray">
            <ChevronsRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onResetLayout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="Reset panel layout to defaults">
            <RotateCcw className="h-3 w-3" /> Reset layout
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={dockedIds} strategy={verticalListSortingStrategy}>
            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
              {dockedIds.map((id) => (
                <DockedPanel
                  key={id}
                  id={id}
                  title={panelTitles[id]}
                  collapsed={layout.panels[id].collapsed}
                  onToggleCollapsed={() => onToggleCollapsed(id)}
                  onPopOut={() => onPopOut(id)}
                >
                  {panelContent[id]}
                </DockedPanel>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {floatingIds.map((id) => (
        <FloatingPanel
          key={id}
          title={panelTitles[id]}
          collapsed={layout.panels[id].collapsed}
          floatX={layout.panels[id].floatX}
          floatY={layout.panels[id].floatY}
          onToggleCollapsed={() => onToggleCollapsed(id)}
          onDock={() => onDock(id)}
          onMove={(x, y) => onMove(id, x, y)}
        >
          {panelContent[id]}
        </FloatingPanel>
      ))}
    </>
  );
}
