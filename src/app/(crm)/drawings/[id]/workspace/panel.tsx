"use client";

import { useRef, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, PictureInPicture2, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PanelId } from "./use-workspace-layout";

function PanelHeader({
  title,
  collapsed,
  onToggleCollapsed,
  dragHandle,
  trailing,
  draggableHeaderProps,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  dragHandle?: ReactNode;
  trailing: ReactNode;
  draggableHeaderProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const { className: extraClassName, ...restHeaderProps } = draggableHeaderProps ?? {};
  return (
    <div className={cn("flex items-center gap-1.5 rounded-t-lg border-b bg-muted/40 px-2 py-1.5", extraClassName)} {...restHeaderProps}>
      {dragHandle}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex flex-1 items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {title}
      </button>
      {trailing}
    </div>
  );
}

export type DockedPanelProps = {
  id: PanelId;
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onPopOut: () => void;
  children: ReactNode;
};

/** A panel docked in the tray -- sortable (drag the grip handle, or focus + arrow keys via dnd-kit's KeyboardSensor). Only ever rendered inside workspace-tray.tsx's DndContext/SortableContext. */
export function DockedPanel({ id, title, collapsed, onToggleCollapsed, onPopOut, children }: DockedPanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("rounded-lg border bg-card", isDragging && "opacity-60 shadow-lg")}>
      <PanelHeader
        title={title}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        dragHandle={
          <button type="button" className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing" {...attributes} {...listeners} aria-label={`Reorder ${title} panel`}>
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        }
        trailing={
          <button type="button" onClick={onPopOut} className="text-muted-foreground hover:text-foreground" title="Pop out into a floating window" aria-label={`Pop out ${title} panel`}>
            <PictureInPicture2 className="h-3.5 w-3.5" />
          </button>
        }
      />
      {!collapsed && <div className="p-2">{children}</div>}
    </div>
  );
}

export type FloatingPanelProps = {
  title: string;
  collapsed: boolean;
  floatX: number;
  floatY: number;
  onToggleCollapsed: () => void;
  onDock: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
};

/**
 * A popped-out panel -- a fixed-position window dragged by its own header
 * via plain pointer events, no dnd-kit involved (it's not part of the
 * tray's sortable list while floating, and never rendered inside a
 * DndContext, so it carries no dnd-kit hook at all -- keeps this
 * independent of whatever that library assumes about its context).
 */
export function FloatingPanel({ title, collapsed, floatX, floatY, onToggleCollapsed, onDock, onMove, children }: FloatingPanelProps) {
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  function startDrag(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: floatX, originY: floatY };
  }
  function onDrag(e: React.PointerEvent) {
    if (!dragState.current) return;
    const { startX, startY, originX, originY } = dragState.current;
    onMove(Math.max(0, originX + (e.clientX - startX)), Math.max(0, originY + (e.clientY - startY)));
  }
  function endDrag() {
    dragState.current = null;
  }

  return (
    <div className="fixed z-30 w-72 max-w-[90vw] rounded-lg border bg-card shadow-xl" style={{ left: floatX, top: floatY }}>
      <PanelHeader
        title={title}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        draggableHeaderProps={{ className: "cursor-move select-none", onPointerDown: startDrag, onPointerMove: onDrag, onPointerUp: endDrag }}
        trailing={
          <button type="button" onClick={onDock} className="text-muted-foreground hover:text-foreground" title="Dock back into the tray" aria-label={`Dock ${title} panel`}>
            <PinOff className="h-3.5 w-3.5" />
          </button>
        }
      />
      {!collapsed && <div className="max-h-[60vh] overflow-auto p-2">{children}</div>}
    </div>
  );
}
