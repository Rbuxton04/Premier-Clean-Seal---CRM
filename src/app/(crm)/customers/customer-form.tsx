"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createCustomerAction, updateCustomerAction, type FormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Defaults = {
  name?: string; company?: string; phone?: string; email?: string;
  notes?: string; marketingEmail?: boolean; marketingSms?: boolean;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Saving…" : label}</Button>;
}

export function CustomerForm({ mode, id, defaults = {} }: { mode: "create" | "edit"; id?: string; defaults?: Defaults }) {
  const action = mode === "create" ? createCustomerAction : updateCustomerAction.bind(null, id!);
  const [state, formAction] = useFormState<FormState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" defaultValue={defaults.name} />
          {state?.errors?.name && <p className="text-xs text-destructive">{state.errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" defaultValue={defaults.company} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaults.email} />
          {state?.errors?.email && <p className="text-xs text-destructive">{state.errors.email}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults.notes} placeholder="Anything useful to remember about this customer…" />
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="marketingEmail" defaultChecked={defaults.marketingEmail} className="h-4 w-4 rounded border-input accent-[#3C2263]" />
          Consent to marketing emails
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="marketingSms" defaultChecked={defaults.marketingSms} className="h-4 w-4 rounded border-input accent-[#3C2263]" />
          Consent to marketing SMS
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Submit label={mode === "create" ? "Create customer" : "Save changes"} />
        {state && <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>}
      </div>
    </form>
  );
}
