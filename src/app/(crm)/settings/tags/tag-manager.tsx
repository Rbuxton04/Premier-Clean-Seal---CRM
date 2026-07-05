"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { createTagAction, updateTagAction, deleteTagAction, type TagFormState } from "../tag-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PALETTE = ["#3C2263", "#6A46A8", "#1E7A5A", "#B45309", "#B91C1C", "#0369A1", "#4B5563", "#9D174D"];

type Tag = { id: string; name: string; colour: string; _count: { customers: number } };

function AddButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "Adding…" : "Add tag"}</Button>;
}

export function TagManager({ tags }: { tags: Tag[] }) {
  const [state, formAction] = useFormState<TagFormState, FormData>(createTagAction, null);
  const [colour, setColour] = useState(PALETTE[0]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-3">
        {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet. Add your first below.</p>}
        {tags.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3">
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: t.colour }}>
              {t.name}
            </span>
            <span className="text-xs text-muted-foreground">{t._count.customers} client{t._count.customers === 1 ? "" : "s"}</span>
            <form action={deleteTagAction.bind(null, t.id)} className="ml-auto">
              <Button variant="ghost" size="icon" type="submit" aria-label={`Delete ${t.name}`}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </form>
          </div>
        ))}
      </div>

      <form action={formAction} className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">Add a tag</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="e.g. Contractor, Hotel, Letting agent" className="w-56" />
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColour(c)}
                  aria-label={`Colour ${c}`}
                  className="h-7 w-7 rounded-full border-2 transition-transform"
                  style={{ backgroundColor: c, borderColor: colour === c ? "#000" : "transparent", transform: colour === c ? "scale(1.1)" : "none" }}
                />
              ))}
            </div>
            <input type="hidden" name="colour" value={colour} />
          </div>
          <AddButton />
        </div>
        {state && <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>}
      </form>
    </div>
  );
}
