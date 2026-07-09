"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Camera, ChevronDown, ChevronUp, ImageOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { addWorkLogAction, deleteWorkLogAction, type FormState } from "../actions";
import { workLogAreas, workLogAreaLabels } from "@/validators/work-log";

type Photo = { id: string; url: string; thumbnailUrl: string | null };
export type WorkLogEntry = {
  id: string;
  description: string;
  productId: string | null;
  productText: string;
  colour: string;
  area: string | null;
  batchNumber: string | null;
  completedAt: Date | string;
  photos: Photo[];
};
export type ProductOption = { id: string; manufacturer: string; name: string; colour: string };

function monthYear(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "Adding…" : "Add entry"}</Button>;
}

function WorkLogForm({ customerId, propertyId, products }: { customerId: string; propertyId: string; products: ProductOption[] }) {
  const action = addWorkLogAction.bind(null, customerId, propertyId);
  const [state, formAction] = useFormState<FormState, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);

  const [comboText, setComboText] = useState("");
  const [productId, setProductId] = useState("");
  const [productText, setProductText] = useState("");
  const [colour, setColour] = useState("");

  const options: ComboboxOption[] = products.map((p) => ({
    value: p.id,
    label: `${p.manufacturer} ${p.name} — ${p.colour}`,
    meta: { productText: `${p.manufacturer} ${p.name}`, colour: p.colour },
  }));

  if (state?.ok) {
    ref.current?.reset();
    if (comboText) { setComboText(""); setProductId(""); setProductText(""); setColour(""); }
  }

  return (
    <form
      ref={ref}
      action={formAction}
      className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-muted/30 p-4"
    >
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`desc-${propertyId}`}>Description *</Label>
        <Input id={`desc-${propertyId}`} name="description" placeholder="e.g. 1 bathroom — cut out & reseal" />
        {state?.errors?.description && <p className="text-xs text-destructive">{state.errors.description}</p>}
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`product-${propertyId}`}>Product / colour *</Label>
        <Combobox
          id={`product-${propertyId}`}
          options={options}
          value={comboText}
          placeholder="Pick from catalogue or type a colour, e.g. Kelmore Mocha"
          onChange={(text) => {
            setComboText(text);
            setProductId("");
            setProductText(text);
            setColour(text);
          }}
          onSelect={(opt) => {
            setComboText(opt.label);
            setProductId(opt.value);
            setProductText(opt.meta!.productText);
            setColour(opt.meta!.colour);
          }}
        />
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="productText" value={productText} />
        <input type="hidden" name="colour" value={colour} />
        {(state?.errors?.productText || state?.errors?.colour) && (
          <p className="text-xs text-destructive">{state.errors.productText ?? state.errors.colour}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`area-${propertyId}`}>Area</Label>
        <Select id={`area-${propertyId}`} name="area" defaultValue="">
          <option value="">No specific area</option>
          {workLogAreas.map((a) => <option key={a} value={a}>{workLogAreaLabels[a]}</option>)}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`batch-${propertyId}`}>Batch number</Label>
        <Input id={`batch-${propertyId}`} name="batchNumber" placeholder="For warranty traceability" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`date-${propertyId}`}>Date completed *</Label>
        <Input id={`date-${propertyId}`} name="completedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        {state?.errors?.completedAt && <p className="text-xs text-destructive">{state.errors.completedAt}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Photos</Label>
        <div className="flex h-9 items-center gap-2 rounded-md border border-dashed px-3 text-xs text-muted-foreground">
          <ImageOff className="h-3.5 w-3.5" /> Coming soon — needs Supabase Storage set up
        </div>
      </div>

      <div className="sm:col-span-2"><Submit /></div>
    </form>
  );
}

function WorkLogEntryRow({ customerId, entry }: { customerId: string; entry: WorkLogEntry }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{entry.description} — {entry.colour}</p>
        <p className="text-xs text-muted-foreground">
          {monthYear(entry.completedAt)}
          {entry.area && ` · ${workLogAreaLabels[entry.area as keyof typeof workLogAreaLabels] ?? entry.area}`}
          {entry.batchNumber && ` · Batch ${entry.batchNumber}`}
        </p>
        {entry.photos.length > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Camera className="h-3.5 w-3.5" /> {entry.photos.length}
          </p>
        )}
      </div>
      <form action={deleteWorkLogAction.bind(null, customerId, entry.id)}>
        <Button variant="ghost" size="icon" type="submit" aria-label="Delete work log entry">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </form>
    </li>
  );
}

export function WorkLogPanel({
  customerId,
  propertyId,
  entries,
  products,
}: {
  customerId: string;
  propertyId: string;
  entries: WorkLogEntry[];
  products: ProductOption[];
}) {
  const [formOpen, setFormOpen] = useState(entries.length === 0);

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Work log{entries.length > 0 ? ` (${entries.length})` : ""}
        </p>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {formOpen ? <>Hide form <ChevronUp className="h-3 w-3" /></> : <>Add entry <ChevronDown className="h-3 w-3" /></>}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No work logged yet at this property.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => <WorkLogEntryRow key={e.id} customerId={customerId} entry={e} />)}
        </ul>
      )}

      {formOpen && <WorkLogForm customerId={customerId} propertyId={propertyId} products={products} />}
    </div>
  );
}
