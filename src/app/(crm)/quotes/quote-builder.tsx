"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { quoteUnits } from "@/validators/quote";
import { createQuoteAction, updateQuoteAction, type QuoteFormState } from "./actions";
import { QuotePreview } from "./quote-preview";

type Row = { key: string; description: string; quantity: number; unit: string; unitPrice: number };

let rowSeq = 0;
function newRow(partial?: Partial<Row>): Row {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, description: "", quantity: 1, unit: "each", unitPrice: 0, ...partial };
}

/** Mirrors applyVat() in src/lib/settings.ts for the live preview — that
 * server-only helper can't be imported into a client component. The real,
 * persisted totals are always computed server-side via applyVat itself. */
function computeTotals(subtotal: number, org: { vatRegistered: boolean; vatRatePercent: number }) {
  const rate = org.vatRegistered ? org.vatRatePercent : 0;
  const vatAmount = +(subtotal * (rate / 100)).toFixed(2);
  return { vatApplied: org.vatRegistered, vatRatePercent: rate, vatAmount, total: +(subtotal + vatAmount).toFixed(2) };
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Saving…" : label}</Button>;
}

export function QuoteBuilder({
  mode,
  quoteId,
  quoteNumber,
  customers,
  products,
  org,
  initial,
}: {
  mode: "create" | "edit";
  quoteId?: string;
  quoteNumber?: string;
  customers: Array<{ id: string; name: string; company: string | null }>;
  products: Array<{ id: string; manufacturer: string; name: string; colour: string }>;
  org: { vatRegistered: boolean; vatRatePercent: number; defaultWarrantyMonths: number };
  initial: {
    customerId: string;
    enquiryId?: string;
    scopeOfWorks: string;
    terms: string;
    warrantyMonths: number;
    depositAmount?: number;
    lineItems: Array<{ description: string; quantity: number; unit: string; unitPrice: number }>;
  };
}) {
  const action = mode === "create" ? createQuoteAction : updateQuoteAction.bind(null, quoteId!);
  const [state, formAction] = useFormState<QuoteFormState, FormData>(action, null);

  const [customerId, setCustomerId] = useState(initial.customerId);
  const [scopeOfWorks, setScopeOfWorks] = useState(initial.scopeOfWorks);
  const [terms, setTerms] = useState(initial.terms);
  const [warrantyMonths, setWarrantyMonths] = useState(initial.warrantyMonths);
  const [depositAmount, setDepositAmount] = useState(initial.depositAmount ?? 0);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.lineItems.length > 0 ? initial.lineItems.map((i) => newRow(i)) : [newRow()]
  );

  const customerOptions: ComboboxOption[] = customers.map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} (${c.company})` : c.name,
  }));
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const [customerText, setCustomerText] = useState(selectedCustomer ? (selectedCustomer.company ? `${selectedCustomer.name} (${selectedCustomer.company})` : selectedCustomer.name) : "");

  const productOptions: ComboboxOption[] = products.map((p) => ({
    value: p.id,
    label: `${p.manufacturer} ${p.name} — ${p.colour}`,
  }));

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }
  function moveRow(key: string, dir: -1 | 1) {
    setRows((rs) => {
      const i = rs.findIndex((r) => r.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const subtotal = useMemo(() => +rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0).toFixed(2), [rows]);
  const totals = useMemo(() => computeTotals(subtotal, org), [subtotal, org]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="customerId" value={customerId} />
        {initial.enquiryId && <input type="hidden" name="enquiryId" value={initial.enquiryId} />}
        <input
          type="hidden"
          name="lineItemsJson"
          value={JSON.stringify(rows.map(({ description, quantity, unit, unitPrice }) => ({ description, quantity, unit, unitPrice })))}
        />

        {mode === "create" ? (
          <div className="space-y-1.5">
            <Label htmlFor="customer">Customer *</Label>
            <Combobox
              id="customer"
              options={customerOptions}
              value={customerText}
              placeholder="Search customers…"
              onChange={setCustomerText}
              onSelect={(opt) => {
                setCustomerText(opt.label);
                setCustomerId(opt.value);
              }}
            />
            {state?.errors?.customerId && <p className="text-xs text-destructive">{state.errors.customerId}</p>}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <p className="text-sm">{selectedCustomer ? selectedCustomer.name : "—"}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="scopeOfWorks">Scope of works *</Label>
          <Textarea id="scopeOfWorks" name="scopeOfWorks" rows={4} value={scopeOfWorks} onChange={(e) => setScopeOfWorks(e.target.value)} />
          {state?.errors?.scopeOfWorks && <p className="text-xs text-destructive">{state.errors.scopeOfWorks}</p>}
        </div>

        <div className="space-y-2">
          <Label>Line items *</Label>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={row.key} className="grid grid-cols-12 items-start gap-1.5 rounded-md border p-2">
                <div className="col-span-12 sm:col-span-5">
                  <Combobox
                    options={productOptions}
                    value={row.description}
                    placeholder="Description or pick from catalogue"
                    onChange={(v) => updateRow(row.key, { description: v })}
                    onSelect={(opt) => updateRow(row.key, { description: opt.label })}
                  />
                </div>
                <Input
                  className="col-span-4 sm:col-span-2"
                  type="number"
                  min="0"
                  step="0.1"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) })}
                  aria-label="Quantity"
                />
                <Select
                  className="col-span-4 sm:col-span-2"
                  value={row.unit}
                  onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                  aria-label="Unit"
                >
                  {quoteUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
                <Input
                  className="col-span-3 sm:col-span-2"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.unitPrice}
                  onChange={(e) => updateRow(row.key, { unitPrice: Number(e.target.value) })}
                  aria-label="Unit price"
                />
                <div className="col-span-1 flex items-center gap-0.5">
                  <button type="button" onClick={() => moveRow(row.key, -1)} disabled={i === 0} aria-label="Move up" className="disabled:opacity-30">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveRow(row.key, 1)} disabled={i === rows.length - 1} aria-label="Move down" className="disabled:opacity-30">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeRow(row.key)} aria-label="Remove row">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setRows((rs) => [...rs, newRow()])}>
            <Plus className="h-3.5 w-3.5" /> Add line
          </Button>
          {state?.errors?.lineItems && <p className="text-xs text-destructive">{state.errors.lineItems}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="depositAmount">Deposit amount (£)</Label>
            <Input id="depositAmount" name="depositAmount" type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="warrantyMonths">Warranty (months)</Label>
            <Input id="warrantyMonths" name="warrantyMonths" type="number" min="0" value={warrantyMonths} onChange={(e) => setWarrantyMonths(Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="terms">Terms</Label>
          <Textarea id="terms" name="terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>

        {state?.message && <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>}
        <SubmitButton label={mode === "create" ? "Create quote" : "Save changes"} />
      </form>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <QuotePreview
          quoteNumber={quoteNumber ?? "Draft"}
          customerName={selectedCustomer?.name ?? ""}
          customerCompany={selectedCustomer?.company}
          scopeOfWorks={scopeOfWorks}
          lineItems={rows}
          subtotal={subtotal}
          vatApplied={totals.vatApplied}
          vatRatePercent={totals.vatRatePercent}
          vatAmount={totals.vatAmount}
          total={totals.total}
          depositAmount={depositAmount}
          terms={terms}
          warrantyMonths={warrantyMonths}
        />
      </div>
    </div>
  );
}
