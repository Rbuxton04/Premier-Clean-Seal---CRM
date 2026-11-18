"use client";

import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGBP, cn } from "@/lib/utils";
import { takeoffItemColourPalette, DEFAULT_ITEM_RATE_PER_METRE_GBP } from "@/validators/takeoff";
import type { TakeoffItemDetail } from "@/services/takeoff.service";

export type ItemsPanelProps = {
  items: TakeoffItemDetail[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onCreateItem: (name: string, colour: string, pricePerMetre: number) => Promise<void>;
  onUpdateItemRate: (id: string, pricePerMetre: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  totalMetres: number;
  grandTotalGbp: number;
};

export function ItemsPanel({ items, selectedItemId, onSelectItem, onCreateItem, onUpdateItemRate, onDeleteItem, totalMetres, grandTotalGbp }: ItemsPanelProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColour, setNewColour] = useState<string>(takeoffItemColourPalette[items.length % takeoffItemColourPalette.length]);
  const [newRate, setNewRate] = useState(String(DEFAULT_ITEM_RATE_PER_METRE_GBP));
  const [pending, setPending] = useState(false);

  async function submitNewItem() {
    if (!newName.trim()) return;
    setPending(true);
    await onCreateItem(newName.trim(), newColour, Number(newRate) || 0);
    setPending(false);
    setAdding(false);
    setNewName("");
    setNewRate(String(DEFAULT_ITEM_RATE_PER_METRE_GBP));
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Items</h2>
        {!adding && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add item
          </Button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
          <Input autoFocus placeholder="Item name (e.g. Floors)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" />
          <div className="flex items-center gap-2">
            <input type="color" value={newColour} onChange={(e) => setNewColour(e.target.value)} className="h-8 w-10 rounded border" aria-label="Colour" />
            <div className="flex flex-wrap gap-1">
              {takeoffItemColourPalette.map((c) => (
                <button key={c} type="button" onClick={() => setNewColour(c)} className="h-5 w-5 rounded-full border" style={{ backgroundColor: c }} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">£</span>
            <Input type="number" step="0.01" min="0" value={newRate} onChange={(e) => setNewRate(e.target.value)} className="h-8 w-24 text-sm" />
            <span className="text-xs text-muted-foreground">/ m</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending || !newName.trim()} onClick={submitNewItem}>
              {pending ? "Adding…" : "Add"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add an item (e.g. &quot;Floors&quot;, &quot;Windows&quot;) before measuring -- every measurement belongs to one.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelectItem(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors",
                  selectedItemId === item.id ? "border-brand-plum bg-brand-plum-soft" : "hover:bg-accent"
                )}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.colour }} />
                <span className="flex-1 truncate font-medium">{item.name}</span>
                {selectedItemId === item.id && <Check className="h-3.5 w-3.5 shrink-0 text-brand-plum" />}
              </button>
              <div className="ml-5 mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{item.totalMetres} m</span>
                <span>×</span>
                <RateInput value={Number(item.pricePerMetre)} onCommit={(v) => onUpdateItemRate(item.id, v)} />
                <span>/m =</span>
                <span className="font-medium text-foreground">{formatGBP(item.lineTotalGbp)}</span>
                <button type="button" onClick={() => onDeleteItem(item.id)} className="ml-auto text-muted-foreground hover:text-destructive" aria-label={`Delete ${item.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t pt-2 text-sm">
        <span className="font-medium">Total: {totalMetres} m</span>
        <span className="font-display text-base font-semibold text-brand-plum">{formatGBP(grandTotalGbp)}</span>
      </div>
    </div>
  );
}

function RateInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Number(local);
        if (!Number.isNaN(n) && n !== value) onCommit(n);
      }}
      className="h-6 w-16 rounded border border-input bg-background px-1 text-xs"
      aria-label="Price per metre"
    />
  );
}
