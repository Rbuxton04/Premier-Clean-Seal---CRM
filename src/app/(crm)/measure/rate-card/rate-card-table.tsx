"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGBP } from "@/lib/utils";
import { takeoffItemColourPalette } from "@/validators/takeoff";
import type { RateCardItem } from "@/services/takeoff-rate-card.service";
import {
  createRateCardItemAction, updateRateCardItemAction, moveRateCardItemAction, deleteRateCardItemAction,
} from "../actions";

type Row = { id: string; name: string; colour: string; pricePerMetre: number };

function toRow(item: RateCardItem): Row {
  return { id: item.id, name: item.name, colour: item.colour, pricePerMetre: Number(item.pricePerMetre) };
}

export function RateCardTable({ items, canManage }: { items: RateCardItem[]; canManage: boolean }) {
  const [rows, setRows] = useState<Row[]>(items.map(toRow));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; colour: string; pricePerMetre: string }>({ name: "", colour: takeoffItemColourPalette[0], pricePerMetre: "8" });
  const [message, setMessage] = useState<string | null>(null);

  function startAdd() {
    setDraft({ name: "", colour: takeoffItemColourPalette[rows.length % takeoffItemColourPalette.length], pricePerMetre: "8" });
    setAdding(true);
    setEditingId(null);
  }

  function startEdit(row: Row) {
    setDraft({ name: row.name, colour: row.colour, pricePerMetre: String(row.pricePerMetre) });
    setEditingId(row.id);
    setAdding(false);
  }

  async function submitAdd() {
    if (!draft.name.trim()) return;
    const result = await createRateCardItemAction({ name: draft.name.trim(), colour: draft.colour, pricePerMetre: Number(draft.pricePerMetre) || 0 });
    if (result.ok) {
      setRows((cur) => [...cur, { id: result.data.id, name: draft.name.trim(), colour: draft.colour, pricePerMetre: Number(draft.pricePerMetre) || 0 }]);
      setAdding(false);
      setMessage(null);
    } else {
      setMessage(result.message);
    }
  }

  async function submitEdit() {
    if (!editingId || !draft.name.trim()) return;
    const input = { name: draft.name.trim(), colour: draft.colour, pricePerMetre: Number(draft.pricePerMetre) || 0 };
    const result = await updateRateCardItemAction(editingId, input);
    if (result.ok) {
      setRows((cur) => cur.map((r) => (r.id === editingId ? { id: editingId, ...input } : r)));
      setEditingId(null);
      setMessage(null);
    } else {
      setMessage(result.message);
    }
  }

  async function move(id: string, direction: "up" | "down") {
    const index = rows.findIndex((r) => r.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= rows.length) return;
    const next = [...rows];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setRows(next);
    await moveRateCardItemAction(id, direction);
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete "${row.name}" from the rate card? Takeoffs that already used it are not affected.`)) return;
    const result = await deleteRateCardItemAction(row.id);
    if (result.ok) setRows((cur) => cur.filter((r) => r.id !== row.id));
    else setMessage(result.message);
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Items ({rows.length})</h2>
        {canManage && !adding && (
          <Button type="button" size="sm" variant="outline" onClick={startAdd}>
            <Plus className="h-3.5 w-3.5" /> Add item
          </Button>
        )}
      </div>

      {message && <p className="text-sm text-destructive">{message}</p>}

      {adding && canManage && <RowEditor draft={draft} setDraft={setDraft} onSave={submitAdd} onCancel={() => setAdding(false)} />}

      {rows.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No rate card items yet. Add the items you quote most often, e.g. &quot;Floors&quot;, &quot;Walls&quot;, &quot;Windows&quot;.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row, i) =>
            editingId === row.id ? (
              <li key={row.id}>
                <RowEditor draft={draft} setDraft={setDraft} onSave={submitEdit} onCancel={() => setEditingId(null)} />
              </li>
            ) : (
              <li key={row.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.colour }} />
                <span className="flex-1 truncate font-medium">{row.name}</span>
                <span className="text-muted-foreground">{formatGBP(row.pricePerMetre)}/m</span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(row.id, "up")} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => move(row.id, "down")} disabled={i === rows.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => startEdit(row)} className="text-muted-foreground hover:text-foreground" aria-label={`Edit ${row.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(row)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${row.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

function RowEditor({
  draft, setDraft, onSave, onCancel,
}: {
  draft: { name: string; colour: string; pricePerMetre: string };
  setDraft: (v: { name: string; colour: string; pricePerMetre: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
      <Input autoFocus placeholder="Item name (e.g. Floors)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-8 text-sm" />
      <div className="flex items-center gap-2">
        <input type="color" value={draft.colour} onChange={(e) => setDraft({ ...draft, colour: e.target.value })} className="h-8 w-10 rounded border" aria-label="Colour" />
        <div className="flex flex-wrap gap-1">
          {takeoffItemColourPalette.map((c) => (
            <button key={c} type="button" onClick={() => setDraft({ ...draft, colour: c })} className="h-5 w-5 rounded-full border" style={{ backgroundColor: c }} aria-label={c} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">£</span>
        <Input type="number" step="0.01" min="0" value={draft.pricePerMetre} onChange={(e) => setDraft({ ...draft, pricePerMetre: e.target.value })} className="h-8 w-24 text-sm" />
        <span className="text-xs text-muted-foreground">/ m</span>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!draft.name.trim()} onClick={onSave}>
          <Check className="h-3.5 w-3.5" /> Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}
