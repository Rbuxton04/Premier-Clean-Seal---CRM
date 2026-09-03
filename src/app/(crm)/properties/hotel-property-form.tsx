"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createHotelPropertyAction, updateHotelPropertyAction, type FormState } from "./actions";
import type { PropertyDetail } from "@/services/hotel-property.service";

type GroupOption = { id: string; name: string };
type CustomerOption = { id: string; name: string; company: string | null };

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? pendingLabel : label}</Button>;
}

function decimalToInput(value: unknown): string {
  return value == null ? "" : String(value);
}

export function HotelPropertyForm({
  property,
  groups,
  customers,
  defaultGroupId,
  onSaved,
}: {
  property?: PropertyDetail;
  groups: GroupOption[];
  customers: CustomerOption[];
  /** Preselects the group picker on the create form when arriving from a group page's "Add property" button. */
  defaultGroupId?: string;
  /** Optional callback fired after a successful inline edit (property page's edit-toggle panel) -- create flow ignores this and redirects instead. */
  onSaved?: () => void;
}) {
  const action = property ? updateHotelPropertyAction.bind(null, property.id) : createHotelPropertyAction;
  const [state, formAction] = useFormState<FormState, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) onSaved?.();
    // Only re-fire when the state object itself changes (a fresh submit
    // result) -- onSaved is a fresh closure every render otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Property name *</Label>
          <Input id="name" name="name" defaultValue={property?.name} placeholder="e.g. The Grand, Manchester" />
          {state?.errors?.name && <p className="text-xs text-destructive">{state.errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hotelGroupId">Hotel group</Label>
          <Select id="hotelGroupId" name="hotelGroupId" defaultValue={property?.hotelGroupId ?? defaultGroupId ?? ""}>
            <option value="">Independent (no group)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerId">Linked customer</Label>
          <Select id="customerId" name="customerId" defaultValue={property?.customerId ?? ""}>
            <option value="">Not yet a customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="addressLine1">Address *</Label>
          <Input id="addressLine1" name="addressLine1" defaultValue={property?.addressLine1} />
          {state?.errors?.addressLine1 && <p className="text-xs text-destructive">{state.errors.addressLine1}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="town">Town</Label>
          <Input id="town" name="town" defaultValue={property?.town ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="region">Region</Label>
          <Input id="region" name="region" defaultValue={property?.region ?? ""} placeholder="e.g. North West" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postcode">Postcode *</Label>
          <Input id="postcode" name="postcode" defaultValue={property?.postcode} />
          {state?.errors?.postcode && <p className="text-xs text-destructive">{state.errors.postcode}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="totalBedrooms">Total bedrooms</Label>
          <Input id="totalBedrooms" name="totalBedrooms" type="number" min="0" defaultValue={property?.totalBedrooms ?? ""} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Site contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="siteContactName">Name</Label>
            <Input id="siteContactName" name="siteContactName" defaultValue={property?.siteContactName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="siteContactRole">Role</Label>
            <Input id="siteContactRole" name="siteContactRole" defaultValue={property?.siteContactRole ?? ""} placeholder="e.g. Maintenance Manager" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="siteContactPhone">Phone</Label>
            <Input id="siteContactPhone" name="siteContactPhone" defaultValue={property?.siteContactPhone ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="siteContactEmail">Email</Label>
            <Input id="siteContactEmail" name="siteContactEmail" type="email" defaultValue={property?.siteContactEmail ?? ""} />
            {state?.errors?.siteContactEmail && <p className="text-xs text-destructive">{state.errors.siteContactEmail}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accessNotes">Access notes</Label>
          <Textarea id="accessNotes" name="accessNotes" defaultValue={property?.accessNotes ?? ""} rows={2} placeholder="How rooms are released, rooms per day, nights-only..." />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sealant & pricing</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sealantBrand">Sealant brand</Label>
            <Input id="sealantBrand" name="sealantBrand" defaultValue={property?.sealantBrand ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sealantColour">Sealant colour</Label>
            <Input id="sealantColour" name="sealantColour" defaultValue={property?.sealantColour ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sealantTubePriceGbp">Tube price (£)</Label>
            <Input id="sealantTubePriceGbp" name="sealantTubePriceGbp" type="number" step="0.01" min="0" defaultValue={decimalToInput(property?.sealantTubePriceGbp)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priceFullBathGbp">Full bath price (£)</Label>
            <Input id="priceFullBathGbp" name="priceFullBathGbp" type="number" step="0.01" min="0" defaultValue={decimalToInput(property?.priceFullBathGbp)} placeholder="Default £250" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priceShowerOnlyGbp">Shower-only price (£)</Label>
            <Input id="priceShowerOnlyGbp" name="priceShowerOnlyGbp" type="number" step="0.01" min="0" defaultValue={decimalToInput(property?.priceShowerOnlyGbp)} placeholder="Default £120" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resealIntervalMonths">Reseal interval (months)</Label>
            <Input id="resealIntervalMonths" name="resealIntervalMonths" type="number" min="1" defaultValue={property?.resealIntervalMonths ?? 36} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={property?.notes ?? ""} rows={3} />
      </div>

      <div className="flex items-center gap-3">
        <Submit label={property ? "Save" : "Create property"} pendingLabel={property ? "Saving…" : "Creating…"} />
        {state && !state.ok && !state.errors && <p className="text-xs text-destructive">{state.message}</p>}
        {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
      </div>
    </form>
  );
}
