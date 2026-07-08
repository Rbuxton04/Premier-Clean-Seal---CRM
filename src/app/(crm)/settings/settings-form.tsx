"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { saveSettings, type SettingsFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  defaults: {
    vatRegistered: boolean;
    vatRatePercent: number;
    vatNumber: string;
    defaultWarrantyMonths: number;
    defaultReminderMonths: number;
    quoteNumberFormat: string;
    invoiceNumberFormat: string;
  };
};

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>;
}

export function SettingsForm({ defaults }: Props) {
  const [state, formAction] = useFormState<SettingsFormState, FormData>(saveSettings, null);
  const [vatOn, setVatOn] = useState(defaults.vatRegistered);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>VAT</CardTitle>
          <CardDescription>
            Off while you&apos;re not VAT registered. Turn this on when you register — new quotes and
            invoices will add VAT from that moment; existing documents are never changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="vatRegistered"
              name="vatRegistered"
              type="checkbox"
              defaultChecked={defaults.vatRegistered}
              onChange={(e) => setVatOn(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-[#3C2263]"
            />
            <Label htmlFor="vatRegistered">We are VAT registered</Label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vatRatePercent">VAT rate (%)</Label>
              <Input id="vatRatePercent" name="vatRatePercent" type="number" step="0.01"
                defaultValue={defaults.vatRatePercent} disabled={!vatOn && false} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vatNumber">VAT number</Label>
              <Input id="vatNumber" name="vatNumber" placeholder="GB 123 4567 89"
                defaultValue={defaults.vatNumber} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Warranty &amp; follow-up defaults</CardTitle>
          <CardDescription>
            Applied automatically when a job completes. Both can still be changed per job.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="defaultWarrantyMonths">Default warranty (months)</Label>
            <Input id="defaultWarrantyMonths" name="defaultWarrantyMonths" type="number"
              min={1} max={120} defaultValue={defaults.defaultWarrantyMonths} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultReminderMonths">Default reminder interval (months)</Label>
            <Input id="defaultReminderMonths" name="defaultReminderMonths" type="number"
              min={1} max={60} defaultValue={defaults.defaultReminderMonths} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document numbering</CardTitle>
          <CardDescription>
            A prefix followed by zeros. #Q-0000 produces #Q-0001, #Q-0002 and so on.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quoteNumberFormat">Quote format</Label>
            <Input id="quoteNumberFormat" name="quoteNumberFormat" defaultValue={defaults.quoteNumberFormat} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoiceNumberFormat">Invoice format</Label>
            <Input id="invoiceNumberFormat" name="invoiceNumberFormat" defaultValue={defaults.invoiceNumberFormat} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <SaveButton />
        {state && (
          <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"} role="status">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
