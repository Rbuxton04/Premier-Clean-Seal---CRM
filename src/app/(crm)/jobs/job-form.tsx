"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { createJobAction, type JobFormState } from "./actions";
import type { CustomerForJobPicker, TechnicianOption } from "@/services/job.service";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create job"}</Button>;
}

export function JobForm({ customers, technicians }: { customers: CustomerForJobPicker[]; technicians: TechnicianOption[] }) {
  const [state, formAction] = useFormState<JobFormState, FormData>(createJobAction, null);
  const [customerId, setCustomerId] = useState("");
  const [customerText, setCustomerText] = useState("");
  const [propertyId, setPropertyId] = useState("");

  const customerOptions: ComboboxOption[] = customers.map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} (${c.company})` : c.name,
  }));
  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <input type="hidden" name="customerId" value={customerId} />

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
            setPropertyId("");
          }}
        />
        {state?.errors?.customerId && <p className="text-xs text-destructive">{state.errors.customerId}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="propertyId">Property</Label>
        <Select id="propertyId" name="propertyId" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} disabled={!selectedCustomer}>
          <option value="">No specific property</option>
          {selectedCustomer?.properties.map((p) => (
            <option key={p.id} value={p.id}>{p.addressLine1}, {p.postcode}</option>
          ))}
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="technicianId">Technician</Label>
          <Select id="technicianId" name="technicianId" defaultValue="">
            <option value="">Unassigned</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scheduledStart">Scheduled date</Label>
          <Input id="scheduledStart" name="scheduledStart" type="date" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="price">Price (£) *</Label>
          <Input id="price" name="price" type="number" min="0" step="0.01" />
          {state?.errors?.price && <p className="text-xs text-destructive">{state.errors.price}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="depositPaid">Deposit paid (£)</Label>
          <Input id="depositPaid" name="depositPaid" type="number" min="0" step="0.01" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>

      {state?.message && <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>}
      <SubmitButton />
    </form>
  );
}
