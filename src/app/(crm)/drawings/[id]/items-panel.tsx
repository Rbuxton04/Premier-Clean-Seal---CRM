"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Check, ListOrdered, BookmarkPlus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatGBP, cn } from "@/lib/utils";
import { takeoffItemColourPalette, DEFAULT_ITEM_RATE_PER_METRE_GBP } from "@/validators/takeoff";
import type { TakeoffItemDetail } from "@/services/takeoff.service";
import type { RateCardItem } from "@/services/takeoff-rate-card.service";

export type ItemsPanelProps = {
  items: TakeoffItemDetail[];
  rateCardItems: RateCardItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onCreateItem: (name: string, colour: string, kind: "LENGTH" | "COUNT", pricePerMetre: number) => Promise<void>;
  onUpdateItemRate: (id: string, pricePerMetre: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onAddAllFromRateCard: () => Promise<void>;
  onSaveItemToRateCard: (item: TakeoffItemDetail) => Promise<void>;
  totalMetres: number;
  grandTotalGbp: number;
};

export function ItemsPanel({
  items, rateCardItems, selectedItemId, onSelectItem, onCreateItem, onUpdateItemRate, onDeleteItem,
  onAddAllFromRateCard, onSaveItemToRateCard, totalMetres, grandTotalGbp,
}: ItemsPanelProps) {
  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState<"rateCard" | "custom">(rateCardItems.length > 0 ? "rateCard" : "custom");
  const [pickedPresetId, setPickedPresetId] = useState(rateCardItems[0]?.id ?? "");
  const [newKind, setNewKind] = useState<"LENGTH" | "COUNT">("LENGTH");
  const [newName, setNewName] = useState("");
  const [newColour, setNewColour] = useState<string>(takeoffItemColourPalette[items.length % takeoffItemColourPalette.length]);
  const [newRate, setNewRate] = useState(String(DEFAULT_ITEM_RATE_PER_METRE_GBP));
  const [pending, setPending] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function resetAddForm() {
    setAdding(false);
    setNewName("");
    setNewRate(String(DEFAULT_ITEM_RATE_PER_METRE_GBP));
  }

  async function submitFromRateCard() {
    const preset = rateCardItems.find((p) => p.id === pickedPresetId);
    if (!preset) return;
    setPending(true);
    // The rate card is LENGTH-only -- it predates Drawings Part 2's count items.
    await onCreateItem(preset.name, preset.colour, "LENGTH", Number(preset.pricePerMetre));
    setPending(false);
    resetAddForm();
  }

  async function submitCustomItem() {
    if (!newName.trim()) return;
    setPending(true);
    await onCreateItem(newName.trim(), newColour, newKind, Number(newRate) || 0);
    setPending(false);
    resetAddForm();
  }

  async function handleAddAll() {
    setAddingAll(true);
    await onAddAllFromRateCard();
    setAddingAll(false);
  }

  async function handleSaveToRateCard(item: TakeoffItemDetail) {
    await onSaveItemToRateCard(item);
    setMessage(`Saved "${item.name}" to the rate card.`);
    setTimeout(() => setMessage(null), 3000);
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

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button type="button" size="sm" variant="outline" disabled={rateCardItems.length === 0 || addingAll} onClick={handleAddAll}>
          <Layers className="h-3.5 w-3.5" /> {addingAll ? "Adding…" : "Add all from rate card"}
        </Button>
        <Link href="/drawings/rate-card" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ListOrdered className="h-3.5 w-3.5" /> Manage rate card
        </Link>
      </div>
      {message && <p className="text-xs text-brand-plum">{message}</p>}

      {adding && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
          {rateCardItems.length > 0 && (
            <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
              <button type="button" onClick={() => setSource("rateCard")} className={cn("flex-1 rounded px-2 py-1", source === "rateCard" ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                From rate card
              </button>
              <button type="button" onClick={() => setSource("custom")} className={cn("flex-1 rounded px-2 py-1", source === "custom" ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                Custom item
              </button>
            </div>
          )}

          {source === "rateCard" && rateCardItems.length > 0 ? (
            <>
              <Select value={pickedPresetId} onChange={(e) => setPickedPresetId(e.target.value)} className="h-9 text-sm">
                {rateCardItems.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {formatGBP(Number(p.pricePerMetre))}/m</option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={pending || !pickedPresetId} onClick={submitFromRateCard}>
                  {pending ? "Adding…" : "Add"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={resetAddForm}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
                <button type="button" onClick={() => setNewKind("LENGTH")} className={cn("flex-1 rounded px-2 py-1", newKind === "LENGTH" ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                  Length (£/m)
                </button>
                <button type="button" onClick={() => setNewKind("COUNT")} className={cn("flex-1 rounded px-2 py-1", newKind === "COUNT" ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                  Count (£/item)
                </button>
              </div>
              <Input autoFocus placeholder={newKind === "COUNT" ? "Item name (e.g. Hotel bathroom)" : "Item name (e.g. Floors)"} value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" />
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
                <span className="text-xs text-muted-foreground">{newKind === "COUNT" ? "/ item" : "/ m"}</span>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={pending || !newName.trim()} onClick={submitCustomItem}>
                  {pending ? "Adding…" : "Add"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={resetAddForm}>Cancel</Button>
              </div>
            </>
          )}
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
                <span>{item.kind === "COUNT" ? item.count : item.totalMetres}{item.kind === "COUNT" ? "" : " m"}</span>
                <span>×</span>
                <RateInput value={Number(item.pricePerMetre)} onCommit={(v) => onUpdateItemRate(item.id, v)} />
                <span>{item.kind === "COUNT" ? "/item =" : "/m ="}</span>
                <span className="font-medium text-foreground">{formatGBP(item.lineTotalGbp)}</span>
                <button type="button" onClick={() => handleSaveToRateCard(item)} className="ml-auto text-muted-foreground hover:text-brand-plum" aria-label={`Save ${item.name} to rate card`} title="Save to rate card">
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onDeleteItem(item.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${item.name}`}>
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
