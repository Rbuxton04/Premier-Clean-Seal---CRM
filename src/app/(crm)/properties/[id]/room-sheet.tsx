"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { bathroomTypeLabels, roomStatusButtons, roomStatusLabels, roomStatusTileClass, roomVisitWorkTypeLabels } from "@/validators/room";
import type { RoomDetail } from "@/services/room.service";
import { markRoomDoneAction, setRoomStatusAction, getRoomDetailAction } from "../actions";
import { roomPriceGbp, monthsAgo } from "./room-pricing";

export function RoomSheet({
  propertyId,
  roomId,
  priceFullBathGbp,
  priceShowerOnlyGbp,
  onClose,
}: {
  propertyId: string;
  roomId: string;
  priceFullBathGbp: number | null;
  priceShowerOnlyGbp: number | null;
  onClose: () => void;
}) {
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  async function reload() {
    const detail = await getRoomDetailAction(roomId);
    setRoom(detail);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function handleStatusClick(status: (typeof roomStatusButtons)[number]) {
    if (pending) return;
    setPending(true);
    if (status === "DONE") await markRoomDoneAction(propertyId, roomId);
    else await setRoomStatusAction(propertyId, roomId, status);
    await reload();
    setPending(false);
  }

  const price = room ? roomPriceGbp(room.bathroomType, priceFullBathGbp, priceShowerOnlyGbp) : null;
  const mostRecentSealant = room?.visits.find((v) => v.sealantBrand || v.sealantColour);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-background p-5 shadow-lg sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !room ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-semibold">Room {room.roomNumber}</h2>
                <p className="text-xs text-muted-foreground">
                  {bathroomTypeLabels[room.bathroomType]} {room.floor ? `· Floor ${room.floor}` : ""} {price != null && `· ${formatGBP(price)}`}
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-accent [@media(pointer:coarse)]:p-2.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {roomStatusButtons.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={pending}
                  onClick={() => handleStatusClick(status)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-sm font-medium transition-colors disabled:opacity-50 [@media(pointer:coarse)]:py-4",
                    room.status === status ? roomStatusTileClass[status] : "bg-background hover:bg-accent"
                  )}
                >
                  {roomStatusLabels[status]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Last resealed</p>
                <p className="font-medium">
                  {room.lastCompletedAt ? `${new Date(room.lastCompletedAt).toLocaleDateString("en-GB")} (${monthsAgo(new Date(room.lastCompletedAt))} mo ago)` : "Never"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sealant used</p>
                <p className="font-medium">
                  {mostRecentSealant ? [mostRecentSealant.sealantBrand, mostRecentSealant.sealantColour].filter(Boolean).join(" — ") : "Not recorded"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Works history</h3>
              {room.visits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {room.visits.map((v) => (
                    <li key={v.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline">{roomVisitWorkTypeLabels[v.workType as keyof typeof roomVisitWorkTypeLabels] ?? v.workType}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(v.visitDate).toLocaleDateString("en-GB")}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {(v.sealantBrand || v.sealantColour) && <span>{[v.sealantBrand, v.sealantColour].filter(Boolean).join(" — ")}</span>}
                        {v.priceGbp != null && <span>{formatGBP(Number(v.priceGbp))}</span>}
                        {v.operative && <span>{v.operative}</span>}
                      </div>
                      {v.notes && <p className="mt-1 text-xs">{v.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
