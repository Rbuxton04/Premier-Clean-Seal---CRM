"use client";

import { useState } from "react";
import { Zap, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { bathroomTypeShortLabels, roomStatusButtons, roomStatusLabels, roomStatusTileClass, roomStatuses } from "@/validators/room";
import type { RoomListItem } from "@/services/room.service";
import { applyQuickMarkAction } from "../actions";
import { isResealDue, formatShortDate } from "./room-pricing";
import { RoomSheet } from "./room-sheet";

const UNASSIGNED_FLOOR = "Unassigned";

export function RoomGrid({
  propertyId,
  rooms,
  resealIntervalMonths,
  priceFullBathGbp,
  priceShowerOnlyGbp,
}: {
  propertyId: string;
  rooms: RoomListItem[];
  resealIntervalMonths: number;
  priceFullBathGbp: number | null;
  priceShowerOnlyGbp: number | null;
}) {
  const [quickMark, setQuickMark] = useState<(typeof roomStatusButtons)[number] | null>(null);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Preserves the query's floor-asc ordering rather than re-sorting --
  // sortIndex within a floor already reflects entry order.
  const floors: Array<{ floor: string; rooms: RoomListItem[] }> = [];
  const floorIndex = new Map<string, number>();
  for (const room of rooms) {
    const key = room.floor?.trim() || UNASSIGNED_FLOOR;
    if (!floorIndex.has(key)) {
      floorIndex.set(key, floors.length);
      floors.push({ floor: key, rooms: [] });
    }
    floors[floorIndex.get(key)!].rooms.push(room);
  }

  async function handleTileClick(room: RoomListItem) {
    if (pendingIds.has(room.id)) return;
    if (!quickMark) {
      setOpenRoomId(room.id);
      return;
    }
    setPendingIds((prev) => new Set(prev).add(room.id));
    await applyQuickMarkAction(propertyId, room.id, quickMark);
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(room.id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {roomStatuses.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-full border", roomStatusTileClass[s])} />
            {roomStatusLabels[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-dashed border-muted-foreground" />
          Reseal due
        </span>
      </div>

      {/* Quick-mark toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
        <span className="flex items-center gap-1 pl-1 text-xs font-medium text-muted-foreground">
          <Zap className="h-3.5 w-3.5" /> Quick-mark:
        </span>
        {roomStatusButtons.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQuickMark((cur) => (cur === s ? null : s))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors [@media(pointer:coarse)]:py-2",
              quickMark === s ? roomStatusTileClass[s] + " border-current" : "bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            {roomStatusLabels[s]}
          </button>
        ))}
        {quickMark && (
          <button type="button" onClick={() => setQuickMark(null)} className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
            <XIcon className="h-3 w-3" /> Stop
          </button>
        )}
      </div>
      {quickMark && (
        <p className="-mt-3 text-xs text-muted-foreground">Tap rooms below to mark them &ldquo;{roomStatusLabels[quickMark]}&rdquo; directly.</p>
      )}

      {/* Floor sections */}
      {floors.map(({ floor, rooms: floorRooms }) => {
        const done = floorRooms.filter((r) => r.status === "DONE").length;
        return (
          <div key={floor} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {floor === UNASSIGNED_FLOOR ? "Unassigned floor" : `Floor ${floor}`} — {done} of {floorRooms.length} done
            </h3>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))" }}>
              {floorRooms.map((room) => {
                const due = isResealDue(room.lastCompletedAt, resealIntervalMonths);
                const pending = pendingIds.has(room.id);
                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={pending}
                    onClick={() => handleTileClick(room)}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-2 text-center transition-opacity disabled:opacity-50 [@media(pointer:coarse)]:min-h-[72px]",
                      roomStatusTileClass[room.status],
                      due && "border-2 border-dashed"
                    )}
                  >
                    <span className="text-sm font-semibold leading-none">{room.roomNumber}</span>
                    <span className="text-[10px] leading-none opacity-80">{bathroomTypeShortLabels[room.bathroomType]}</span>
                    <span className="text-[10px] leading-none opacity-70">{room.lastCompletedAt ? formatShortDate(new Date(room.lastCompletedAt)) : "—"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {openRoomId && (
        <RoomSheet
          propertyId={propertyId}
          roomId={openRoomId}
          priceFullBathGbp={priceFullBathGbp}
          priceShowerOnlyGbp={priceShowerOnlyGbp}
          onClose={() => setOpenRoomId(null)}
        />
      )}
    </div>
  );
}
