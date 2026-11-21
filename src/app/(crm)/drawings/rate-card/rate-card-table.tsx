"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGBP, cn } from "@/lib/utils";
import { takeoffItemColourPalette, type MaterialDefaultsValues } from "@/validators/takeoff";
import type { RateCardItem } from "@/services/takeoff-rate-card.service";
import {
  createRateCardItemAction, updateRateCardItemAction, moveRateCardItemAction, deleteRateCardItemAction,
} from "../actions";

type Kind = "LENGTH" | "COUNT";
type Row = {
  id: string; name: string; colour: string; kind: Kind; pricePerMetre: number;
  overrideJointWidthMm: number | null; overrideJointDepthMm: number | null; overrideWastePercent: number | null;
};
type Draft = {
  name: string; colour: string; kind: Kind; pricePerMetre: string;
  overrideJointWidthMm: string; overrideJointDepthMm: string; overrideWastePercent: string;
};

function toRow(item: RateCardItem): Row {
  return {
    id: item.id, name: item.name, colour: item.colour, kind: item.kind, pricePerMetre: Number(item.pricePerMetre),
    overrideJointWidthMm: item.overrideJointWidthMm, overrideJointDepthMm: item.overrideJointDepthMm, overrideWastePercent: item.overrideWastePercent,
  };
}

function draftToInput(draft: Draft) {
  return {
    name: draft.name.trim(),
    colour: draft.colour,
    kind: draft.kind,
    pricePerMetre: Number(draft.pricePerMetre) || 0,
    overrideJointWidthMm: draft.overrideJointWidthMm.trim() ? Number(draft.overrideJointWidthMm) : null,
    overrideJointDepthMm: draft.overrideJointDepthMm.trim() ? Number(draft.overrideJointDepthMm) : null,
    overrideWastePercent: draft.overrideWastePercent.trim() ? Number(draft.overrideWastePercent) : null,
  };
}

function emptyDraft(colour: string): Draft {
  return { name: "", colour, kind: "LENGTH", pricePerMetre: "8", overrideJointWidthMm: "", overrideJointDepthMm: "", overrideWastePercent: "" };
}

function rowToDraft(row: Row): Draft {
  return {
    name: row.name, colour: row.colour, kind: row.kind, pricePerMetre: String(row.pricePerMetre),
    overrideJointWidthMm: row.overrideJointWidthMm != null ? String(row.overrideJointWidthMm) : "",
    overrideJointDepthMm: row.overrideJointDepthMm != null ? String(row.overrideJointDepthMm) : "",
    overrideWastePercent: row.overrideWastePercent != null ? String(row.overrideWastePercent) : "",
  };
}

export function RateCardTable({ items, canManage, materialDefaults }: { items: RateCardItem[]; canManage: boolean; materialDefaults: MaterialDefaultsValues }) {
  const [rows, setRows] = useState<Row[]>(items.map(toRow));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(takeoffItemColourPalette[0]));
  const [message, setMessage] = useState<string | null>(null);

  function startAdd() {
    setDraft(emptyDraft(takeoffItemColourPalette[rows.length % takeoffItemColourPalette.length]));
    setAdding(true);
    setEditingId(null);
  }

  function startEdit(row: Row) {
    setDraft(rowToDraft(row));
    setEditingId(row.id);
    setAdding(false);
  }

  async function submitAdd() {
    const input = draftToInput(draft);
    if (!input.name) return;
    const result = await createRateCardItemAction(input);
    if (result.ok) {
      setRows((cur) => [...cur, { id: result.data.id, ...input }]);
      setAdding(false);
      setMessage(null);
    } else {
      setMessage(result.message);
    }
  }

  async function submitEdit() {
    if (!editingId) return;
    const input = draftToInput(draft);
    if (!input.name) return;
    const result = await updateRateCardItemAction(editingId, input);
    if (result.ok) {
      setRows((cur) => cur.map((r) => (r.id === editingId ? { id: editingId, ...input } : r)));
      setEditingId(null);
      setMessage(null);
    } else {
      setMessage(result.message);
    }
  }

  async function move(row: Row, direction: "up" | "down") {
    const group = rows.filter((r) => r.kind === row.kind);
    const index = group.findIndex((r) => r.id === row.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= group.length) return;
    const otherId = group[swapIndex].id;
    setRows((cur) => {
      const a = cur.findIndex((r) => r.id === row.id);
      const b = cur.findIndex((r) => r.id === otherId);
      const next = [...cur];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
    await moveRateCardItemAction(row.id, direction);
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete ${row.name} from the rate card? Drawings that already used it are not affected.`)) return;
    const result = await deleteRateCardItemAction(row.id);
    if (result.ok) setRows((cur) => cur.filter((r) => r.id !== row.id));
    else setMessage(result.message);
  }

  const lengthRows = rows.filter((r) => r.kind === "LENGTH");
  const countRows = rows.filter((r) => r.kind === "COUNT");

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

      {adding && canManage && (
        <RowEditor draft={draft} setDraft={setDraft} materialDefaults={materialDefaults} onSave={submitAdd} onCancel={() => setAdding(false)} />
      )}

      {rows.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No rate card items yet. Add the items you quote most often, e.g. Floors, Walls, Windows.</p>
      ) : (
        <div className="space-y-4">
          <RowGroup
            title="Length (£/m)"
            rows={lengthRows}
            editingId={editingId}
            draft={draft}
            setDraft={setDraft}
            canManage={canManage}
            materialDefaults={materialDefaults}
            onSubmitEdit={submitEdit}
            onCancelEdit={() => setEditingId(null)}
            onStartEdit={startEdit}
            onMove={move}
            onRemove={remove}
            emptyText="No length items yet."
          />
          <RowGroup
            title="Count (£/item)"
            rows={countRows}
            editingId={editingId}
            draft={draft}
            setDraft={setDraft}
            canManage={canManage}
            materialDefaults={materialDefaults}
            onSubmitEdit={submitEdit}
            onCancelEdit={() => setEditingId(null)}
            onStartEdit={startEdit}
            onMove={move}
            onRemove={remove}
            emptyText="No count items yet."
          />
        </div>
      )}
    </div>
  );
}

function RowGroup({
  title, rows, editingId, draft, setDraft, canManage, materialDefaults, onSubmitEdit, onCancelEdit, onStartEdit, onMove, onRemove, emptyText,
}: {
  title: string;
  rows: Row[];
  editingId: string | null;
  draft: Draft;
  setDraft: (v: Draft) => void;
  canManage: boolean;
  materialDefaults: MaterialDefaultsValues;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: (row: Row) => void;
  onMove: (row: Row, direction: "up" | "down") => void;
  onRemove: (row: Row) => void;
  emptyText: string;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row, i) =>
            editingId === row.id ? (
              <li key={row.id}>
                <RowEditor draft={draft} setDraft={setDraft} materialDefaults={materialDefaults} onSave={onSubmitEdit} onCancel={onCancelEdit} />
              </li>
            ) : (
              <li key={row.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.colour }} />
                  <span className="flex-1 truncate font-medium">{row.name}</span>
                  <span className="text-muted-foreground">{formatGBP(row.pricePerMetre)}{row.kind === "COUNT" ? "/item" : "/m"}</span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => onMove(row, "up")} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => onMove(row, "down")} disabled={i === rows.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => onStartEdit(row)} className="text-muted-foreground hover:text-foreground" aria-label={`Edit ${row.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => onRemove(row)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${row.name}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {row.kind === "LENGTH" && (row.overrideJointWidthMm != null || row.overrideJointDepthMm != null || row.overrideWastePercent != null) && (
                  <p className="ml-5 mt-1 text-xs text-muted-foreground">
                    Materials override: {row.overrideJointWidthMm ?? materialDefaults.jointWidthMm}mm x {row.overrideJointDepthMm ?? materialDefaults.jointDepthMm}mm, {row.overrideWastePercent ?? materialDefaults.wastePercent}% waste
                  </p>
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
  draft, setDraft, materialDefaults, onSave, onCancel,
}: {
  draft: Draft;
  setDraft: (v: Draft) => void;
  materialDefaults: MaterialDefaultsValues;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
      <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
        <button type="button" onClick={() => setDraft({ ...draft, kind: "LENGTH" })} className={cn("flex-1 rounded px-2 py-1", draft.kind === "LENGTH" ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
          Length (£/m)
        </button>
        <button type="button" onClick={() => setDraft({ ...draft, kind: "COUNT" })} className={cn("flex-1 rounded px-2 py-1", draft.kind === "COUNT" ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
          Count (£/item)
        </button>
      </div>
      <Input autoFocus placeholder={draft.kind === "COUNT" ? "Item name (e.g. Hotel bathroom)" : "Item name (e.g. Floors)"} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-8 text-sm" />
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
        <span className="text-xs text-muted-foreground">{draft.kind === "COUNT" ? "/ item" : "/ m"}</span>
      </div>
      {draft.kind === "LENGTH" && (
        <div className="space-y-1 rounded-md border bg-card p-2">
          <p className="text-xs text-muted-foreground">Worst-case materials override -- blank uses the organisation default.</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Width (mm)</span>
              <Input type="number" min="1" placeholder={String(materialDefaults.jointWidthMm)} value={draft.overrideJointWidthMm} onChange={(e) => setDraft({ ...draft, overrideJointWidthMm: e.target.value })} className="h-7 text-xs" />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Depth (mm)</span>
              <Input type="number" min="1" placeholder={String(materialDefaults.jointDepthMm)} value={draft.overrideJointDepthMm} onChange={(e) => setDraft({ ...draft, overrideJointDepthMm: e.target.value })} className="h-7 text-xs" />
            </label>
            <label className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Waste %</span>
              <Input type="number" min="0" placeholder={String(materialDefaults.wastePercent)} value={draft.overrideWastePercent} onChange={(e) => setDraft({ ...draft, overrideWastePercent: e.target.value })} className="h-7 text-xs" />
            </label>
          </div>
        </div>
      )}
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
