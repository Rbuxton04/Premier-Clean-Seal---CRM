"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { workTypes, workTypeLabels } from "@/validators/enquiry";
import { submitRebookingAction, type RebookingFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Request a visit"}
    </Button>
  );
}

export function RebookingForm({
  token,
  reminderId,
  properties,
}: {
  token: string;
  reminderId?: string;
  properties: Array<{ id: string; addressLine1: string; postcode: string }>;
}) {
  const action = submitRebookingAction.bind(null, token);
  const [state, formAction] = useFormState<RebookingFormState, FormData>(action, null);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);

  if (state?.ok) {
    return (
      <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        {state.message}
      </p>
    );
  }

  if (properties.length === 0) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t find a property on file for you — please call or email us directly.</p>;
  }

  function toggleWorkType(value: string) {
    setSelectedWorkTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  return (
    <form action={formAction} className="space-y-4">
      {reminderId && <input type="hidden" name="reminderId" value={reminderId} />}
      {selectedWorkTypes.map((w) => (
        <input key={w} type="hidden" name="workTypes" value={w} />
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="propertyId">Property</Label>
        <Select id="propertyId" name="propertyId" defaultValue={properties[0].id}>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.addressLine1}, {p.postcode}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Type of work</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {workTypes.map((t) => (
            <label key={t} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox checked={selectedWorkTypes.includes(t)} onChange={() => toggleWorkType(t)} />
              {workTypeLabels[t]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Tell us what needs a look</Label>
        <Textarea id="description" name="description" rows={4} placeholder="e.g. bathroom silicone looking tired again" />
      </div>

      {state?.message && !state.ok && <p className="text-xs text-destructive">{state.message}</p>}
      <SubmitButton />
    </form>
  );
}
