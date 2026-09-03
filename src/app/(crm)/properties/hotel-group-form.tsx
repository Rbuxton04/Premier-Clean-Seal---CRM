"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createHotelGroupAction, updateHotelGroupAction, type FormState } from "./actions";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? pendingLabel : label}</Button>;
}

export function HotelGroupForm({
  group,
}: {
  group?: { id: string; name: string; contactName: string | null; contactEmail: string | null; contactPhone: string | null; notes: string | null };
}) {
  const action = group ? updateHotelGroupAction.bind(null, group.id) : createHotelGroupAction;
  const [state, formAction] = useFormState<FormState, FormData>(action, null);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="name">Group name *</Label>
        <Input id="name" name="name" defaultValue={group?.name} placeholder="e.g. Classic Lodges" />
        {state?.errors?.name && <p className="text-xs text-destructive">{state.errors.name}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contactName">Group contact name</Label>
        <Input id="contactName" name="contactName" defaultValue={group?.contactName ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contactPhone">Group contact phone</Label>
        <Input id="contactPhone" name="contactPhone" defaultValue={group?.contactPhone ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="contactEmail">Group contact email</Label>
        <Input id="contactEmail" name="contactEmail" type="email" defaultValue={group?.contactEmail ?? ""} />
        {state?.errors?.contactEmail && <p className="text-xs text-destructive">{state.errors.contactEmail}</p>}
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={group?.notes ?? ""} rows={3} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label={group ? "Save" : "Create group"} pendingLabel={group ? "Saving…" : "Creating…"} />
        {state && !state.ok && !state.errors && <p className="text-xs text-destructive">{state.message}</p>}
        {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
      </div>
    </form>
  );
}
