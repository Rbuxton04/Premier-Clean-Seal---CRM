"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Download, Mail, MessageSquare, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eraseCustomerAction, updateConsentAction, type EraseFormState } from "./gdpr-actions";

function EraseButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? "Erasing…" : "Permanently erase this customer"}
    </Button>
  );
}

export function GdprPanel({
  customerId,
  customerName,
  isAdmin,
  marketingEmail,
  marketingSms,
  consentAt,
  anonymised,
}: {
  customerId: string;
  customerName: string;
  isAdmin: boolean;
  marketingEmail: boolean;
  marketingSms: boolean;
  consentAt: Date | null;
  anonymised: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmName, setConfirmName] = useState("");
  const action = eraseCustomerAction.bind(null, customerId);
  const [state, formAction] = useFormState<EraseFormState, FormData>(action, null);

  return (
    <div className="max-w-2xl space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">Consent centre</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="inline-flex items-center gap-2 text-sm"><Mail className="h-4 w-4" /> Email marketing</span>
            <div className="flex items-center gap-2">
              <Badge variant={marketingEmail ? "success" : "outline"}>{marketingEmail ? "Opted in" : "Opted out"}</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => startTransition(() => updateConsentAction(customerId, !marketingEmail, marketingSms))}
              >
                {marketingEmail ? "Opt out" : "Opt in"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="inline-flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" /> SMS marketing</span>
            <div className="flex items-center gap-2">
              <Badge variant={marketingSms ? "success" : "outline"}>{marketingSms ? "Opted in" : "Opted out"}</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => startTransition(() => updateConsentAction(customerId, marketingEmail, !marketingSms))}
              >
                {marketingSms ? "Opt out" : "Opt in"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {consentAt ? `Consent last recorded ${new Date(consentAt).toLocaleString("en-GB")}.` : "No consent currently recorded."}
            {" "}Opting out here takes effect immediately across reminders and campaigns.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Export data (subject access request)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Downloads everything held about this customer — profile, properties, enquiries, quotes, jobs, invoices,
            warranties, timeline, and communications — as a JSON file. Admin-only; every export is logged.
          </p>
          {isAdmin ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/gdpr/export/${customerId}`} download>
                <Download className="h-3.5 w-3.5" /> Download full export
              </a>
            </Button>
          ) : (
            <Badge variant="warning">Admin-only.</Badge>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <TriangleAlert className="h-4 w-4" /> Erase customer (right to be forgotten)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {anonymised ? (
              <Badge variant="warning">This customer's data has already been erased.</Badge>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Irreversibly scrubs this customer's name, contact details, and raw enquiry/property data. Quotes,
                  jobs, invoices and warranties are kept for accounting purposes but no longer carry any personal
                  identifiers once this runs. This cannot be undone.
                </p>
                <form action={formAction} className="space-y-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="customerName">Type the customer's name ({customerName}) to confirm</Label>
                    <Input id="customerName" name="customerName" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmText">Type DELETE to confirm</Label>
                    <Input id="confirmText" name="confirmText" />
                  </div>
                  {state && <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>}
                  <EraseButton />
                </form>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
