"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addPropertyAction, type FormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { propertyTypes, propertyTypeLabels } from "@/validators/customer";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "Adding…" : "Add property"}</Button>;
}

export function PropertyForm({ customerId }: { customerId: string }) {
  const action = addPropertyAction.bind(null, customerId);
  const [state, formAction] = useFormState<FormState, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);
  if (state?.ok) ref.current?.reset();

  return (
    <form ref={ref} action={formAction} className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="addressLine1">Address line 1 *</Label>
        <Input id="addressLine1" name="addressLine1" />
        {state?.errors?.addressLine1 && <p className="text-xs text-destructive">{state.errors.addressLine1}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addressLine2">Address line 2</Label>
        <Input id="addressLine2" name="addressLine2" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="postcode">Postcode *</Label>
        <Input id="postcode" name="postcode" />
        {state?.errors?.postcode && <p className="text-xs text-destructive">{state.errors.postcode}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="propertyType">Property type</Label>
        <Select id="propertyType" name="propertyType" defaultValue="RESIDENTIAL">
          {propertyTypes.map((t) => <option key={t} value={t}>{propertyTypeLabels[t]}</option>)}
        </Select>
      </div>
      <div className="sm:col-span-2"><Submit /></div>
    </form>
  );
}
