"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Camera, Clock, Video } from "lucide-react";
import { cn, formatGBP } from "@/lib/utils";
import { enquiryStages, enquiryStageLabels, priorityDotClass } from "@/validators/enquiry";
import type { EnquiryCardItem } from "@/services/enquiry.service";
import { moveEnquiryAction } from "./actions";

function ageLabel(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m ago`;
}

function EnquiryCard({ enquiry }: { enquiry: EnquiryCardItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: enquiry.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link href={`/enquiries/${enquiry.id}`} className="block rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{enquiry.name}</p>
          <span
            className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", priorityDotClass[enquiry.priority as keyof typeof priorityDotClass])}
            title={enquiry.priority}
          />
        </div>
        <p className="text-xs text-muted-foreground">{enquiry.postcode}</p>
        {enquiry.company && <p className="text-xs text-muted-foreground">{enquiry.company}</p>}

        {enquiry.files.length > 0 ? (
          <div className="mt-2 flex gap-1">
            {enquiry.files.slice(0, 4).map((f) => (
              <div key={f.id} className="h-8 w-8 overflow-hidden rounded border bg-muted">
                {f.kind === "VIDEO" ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <Video className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.thumbnailUrl ?? f.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/70">
            <Camera className="h-3 w-3" /> No photos
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {ageLabel(enquiry.createdAt)}
          </span>
          {enquiry.estimatedValue != null && <span className="font-medium text-foreground">{formatGBP(Number(enquiry.estimatedValue))}</span>}
        </div>
        {enquiry.assignedTo && <p className="mt-1 text-xs text-muted-foreground">→ {enquiry.assignedTo.name}</p>}
      </Link>
    </div>
  );
}

function Column({ stage, ids, byId }: { stage: (typeof enquiryStages)[number]; ids: string[]; byId: Record<string, EnquiryCardItem> }) {
  const { setNodeRef } = useDroppable({ id: `col:${stage}` });
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold">{enquiryStageLabels[stage]}</h3>
        <span className="text-xs text-muted-foreground">{ids.length}</span>
      </div>
      <div ref={setNodeRef} className="min-h-[80px] flex-1 space-y-2 p-2">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => byId[id] && <EnquiryCard key={id} enquiry={byId[id]} />)}
        </SortableContext>
      </div>
    </div>
  );
}

export function EnquiryBoard({ initialEnquiries }: { initialEnquiries: EnquiryCardItem[] }) {
  const [byId] = useState<Record<string, EnquiryCardItem>>(() => Object.fromEntries(initialEnquiries.map((e) => [e.id, e])));
  const [columns, setColumns] = useState<Record<string, string[]>>(() => {
    const cols: Record<string, string[]> = Object.fromEntries(enquiryStages.map((s) => [s, [] as string[]]));
    for (const e of [...initialEnquiries].sort((a, b) => a.kanbanOrder - b.kanbanOrder)) cols[e.stage]?.push(e.id);
    return cols;
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function findColumn(id: string): string | null {
    return Object.keys(columns).find((stage) => columns[stage].includes(id)) ?? null;
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const fromCol = findColumn(activeId);
    const toCol = overId.startsWith("col:") ? overId.slice(4) : findColumn(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setColumns((prev) => {
      const fromItems = prev[fromCol].filter((id) => id !== activeId);
      const toItems = [...prev[toCol]];
      const overIndex = overId.startsWith("col:") ? toItems.length : toItems.indexOf(overId);
      const insertAt = overIndex === -1 ? toItems.length : overIndex;
      toItems.splice(insertAt, 0, activeId);
      return { ...prev, [fromCol]: fromItems, [toCol]: toItems };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const id = String(active.id);
    const overId = String(over.id);
    const col = findColumn(id);
    if (!col) return;

    setColumns((prev) => {
      const items = prev[col];
      const oldIndex = items.indexOf(id);
      const targetId = overId.startsWith("col:") ? null : overId;
      const newIndex = targetId ? items.indexOf(targetId) : items.length - 1;
      const reordered = oldIndex === -1 || newIndex === -1 || oldIndex === newIndex ? items : arrayMove(items, oldIndex, newIndex);
      const finalIndex = reordered.indexOf(id);

      moveEnquiryAction(id, col, finalIndex).catch(() => {
        // Best-effort — a page refresh will reconcile state if this ever fails.
      });

      return { ...prev, [col]: reordered };
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {enquiryStages.map((stage) => (
          <Column key={stage} stage={stage} ids={columns[stage]} byId={byId} />
        ))}
      </div>
      <DragOverlay>{activeId && byId[activeId] ? <EnquiryCard enquiry={byId[activeId]} /> : null}</DragOverlay>
    </DndContext>
  );
}
