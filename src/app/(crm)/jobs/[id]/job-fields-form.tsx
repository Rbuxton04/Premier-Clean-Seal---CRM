"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateJobAction, type JobFormState } from "../actions";
import { jobStatuses, jobStatusLabels } from "@/validators/job";

function toDateInputValue(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>;
}

export function JobFieldsForm({
  jobId,
  status,
  technicianId,
  scheduledStart,
  scheduledEnd,
  price,
  depositPaid,
  notes,
  internalNotes,
  isExternal,
  technicians,
  showFinancials = true,
}: {
  jobId: string;
  status: string;
  technicianId: string | null;
  scheduledStart: Date | string | null;
  scheduledEnd: Date | string | null;
  price: unknown;
  depositPaid: unknown;
  notes: string | null;
  internalNotes: string | null;
  isExternal: boolean | null;
  technicians: Array<{ id: string; name: string }>;
  showFinancials?: boolean;
}) {
  const action = updateJobAction.bind(null, jobId);
  const [state, formAction] = useFormState<JobFormState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status}>
            {jobStatuses.map((s) => <option key={s} value={s}>{jobStatusLabels[s]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="technicianId">Technician</Label>
          <Select id="technicianId" name="technicianId" defaultValue={technicianId ?? ""}>
            <option value="">Unassigned</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scheduledStart">Scheduled start</Label>
          <Input id="scheduledStart" name="scheduledStart" type="date" defaultValue={toDateInputValue(scheduledStart)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scheduledEnd">Scheduled end</Label>
          <Input id="scheduledEnd" name="scheduledEnd" type="date" defaultValue={toDateInputValue(scheduledEnd)} />
        </div>
        {showFinancials && (
          <div className="space-y-1.5">
            <Label htmlFor="price">Price (£)</Label>
            <Input id="price" name="price" type="number" min="0" step="0.01" defaultValue={price != null ? Number(price) : ""} />
          </div>
        )}
        {showFinancials && (
          <div className="space-y-1.5">
            <Label htmlFor="depositPaid">Deposit paid (£)</Label>
            <Input id="depositPaid" name="depositPaid" type="number" min="0" step="0.01" defaultValue={depositPaid != null ? Number(depositPaid) : ""} />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isExternal"
          defaultChecked={isExternal ?? false}
          className="h-4 w-4 rounded border-input accent-[#3C2263]"
        />
        External / outdoor job (shows a stronger rain warning on the calendar)
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (visible to customer)</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={notes ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="internalNotes">Internal notes (staff only)</Label>
        <Textarea id="internalNotes" name="internalNotes" rows={2} defaultValue={internalNotes ?? ""} />
      </div>

      {state?.message && <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>}
      <SaveButton />
    </form>
  );
}
