"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { bathroomTypes, bathroomTypeLabels, parseRoomNumberRange } from "@/validators/room";
import { bulkCreateRoomsAction, type BulkCreateRoomsResult } from "../../../actions";

export function RoomGenerator({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [floor, setFloor] = useState("");
  const [range, setRange] = useState("");
  const [bathroomType, setBathroomType] = useState<(typeof bathroomTypes)[number]>("FULL_BATH");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkCreateRoomsResult | null>(null);

  const preview = useMemo(() => {
    if (!range.trim()) return { rooms: [] as string[], error: null as string | null };
    try {
      return { rooms: parseRoomNumberRange(range), error: null as string | null };
    } catch (err) {
      return { rooms: [] as string[], error: err instanceof Error ? err.message : "Invalid range." };
    }
  }, [range]);

  function handleCreate() {
    setResult(null);
    startTransition(async () => {
      const res = await bulkCreateRoomsAction(propertyId, floor, range, bathroomType);
      setResult(res);
      if (res.ok) {
        setRange("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="floor">Floor label</Label>
          <Input id="floor" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. Ground, 1, Annexe" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bathroomType">Bathroom type (applied to the batch)</Label>
          <Select id="bathroomType" value={bathroomType} onChange={(e) => setBathroomType(e.target.value as (typeof bathroomTypes)[number])}>
            {bathroomTypes.map((t) => <option key={t} value={t}>{bathroomTypeLabels[t]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="range">Room numbers</Label>
          <Input id="range" value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 101-124, 112, 114a" />
          <p className="text-xs text-muted-foreground">Accepts a range (101-124), comma lists, and mixed input. Type per room can be edited afterwards.</p>
        </div>
      </div>

      {preview.error && <p className="text-sm text-destructive">{preview.error}</p>}

      {preview.rooms.length > 0 && !preview.error && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">Preview — {preview.rooms.length} room{preview.rooms.length === 1 ? "" : "s"} will be created</p>
          <div className="flex flex-wrap gap-1.5">
            {preview.rooms.map((n) => <Badge key={n} variant="outline">{n}</Badge>)}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleCreate} disabled={pending || preview.rooms.length === 0 || !!preview.error}>
          {pending ? "Creating…" : `Create ${preview.rooms.length || ""} room${preview.rooms.length === 1 ? "" : "s"}`}
        </Button>
        {result && <p className={result.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{result.message}</p>}
      </div>
    </div>
  );
}
