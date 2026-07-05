"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { updateEnquiryFieldsAction, type FieldsFormState } from "../actions";
import { enquiryStages, enquiryStageLabels, priorities, priorityLabels } from "@/validators/enquiry";

type Assignee = { id: string; name: string };

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>;
}

export function EnquiryFieldsForm({
  enquiryId,
  stage,
  priority,
  assignedToId,
  estimatedValue,
  assignees,
}: {
  enquiryId: string;
  stage: string;
  priority: string;
  assignedToId: string | null;
  estimatedValue: unknown;
  assignees: Assignee[];
}) {
  const action = updateEnquiryFieldsAction.bind(null, enquiryId);
  const [state, formAction] = useFormState<FieldsFormState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="stage">Stage</Label>
        <Select id="stage" name="stage" defaultValue={stage}>
          {enquiryStages.map((s) => <option key={s} value={s}>{enquiryStageLabels[s]}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="priority">Priority</Label>
        <Select id="priority" name="priority" defaultValue={priority}>
          {priorities.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assignedToId">Assigned to</Label>
        <Select id="assignedToId" name="assignedToId" defaultValue={assignedToId ?? ""}>
          <option value="">Unassigned</option>
          {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="estimatedValue">Estimated value (£)</Label>
        <Input id="estimatedValue" name="estimatedValue" type="number" min="0" step="0.01" defaultValue={estimatedValue != null ? Number(estimatedValue) : ""} />
      </div>
      {state?.message && <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>}
      <Submit />
    </form>
  );
}
