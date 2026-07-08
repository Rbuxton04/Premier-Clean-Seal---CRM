"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Camera, FileDown, MessageSquare, ShieldCheck, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { BeforeAfterSlider } from "@/components/gallery/before-after-slider";
import { QuotePreview } from "@/app/(crm)/quotes/quote-preview";
import { workTypes, workTypeLabels } from "@/validators/enquiry";
import { allDocumentCategoryLabels } from "@/validators/media";
import type { PortalRequestKind } from "@/validators/portal";
import type { PortalHome } from "@/services/portal.service";
import {
  approvePortalQuoteAction,
  rejectPortalQuoteAction,
  updatePortalContactAction,
  sendPortalMessageAction,
  submitPortalRequestAction,
  type PortalActionState,
} from "./actions";

function SubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "default" | "outline" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Action needed — quote approval
// ---------------------------------------------------------------------------

function QuoteApprovalCard({ token, quote }: { token: string; quote: PortalHome["quotesAwaitingApproval"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const approveAction = approvePortalQuoteAction.bind(null, token, quote.id);
  const rejectAction = rejectPortalQuoteAction.bind(null, token, quote.id);
  const [approveState, approveFormAction] = useFormState<PortalActionState, FormData>(approveAction, null);
  const [rejectState, rejectFormAction] = useFormState<PortalActionState, FormData>(rejectAction, null);

  if (approveState?.ok) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        Quote {quote.quoteNumber} approved — thank you! We&apos;ll be in touch to arrange the work.
      </div>
    );
  }
  if (rejectState?.ok) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        Quote {quote.quoteNumber} declined. If that was a mistake, just send us a message below.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">Quote {quote.quoteNumber}</p>
          <p className="text-sm text-muted-foreground">{formatGBP(Number(quote.total))}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide details" : "View quote"}
        </Button>
      </div>

      {expanded && (
        <QuotePreview
          quoteNumber={quote.quoteNumber}
          customerName={quote.customer.name}
          customerCompany={quote.customer.company}
          propertyAddress={quote.enquiry ? `${quote.enquiry.addressText}, ${quote.enquiry.postcode}` : undefined}
          scopeOfWorks={quote.scopeOfWorks}
          lineItems={quote.lineItems.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit, unitPrice: Number(i.unitPrice) }))}
          subtotal={Number(quote.subtotal)}
          vatApplied={quote.vatApplied}
          vatRatePercent={Number(quote.vatRatePercent)}
          vatAmount={Number(quote.vatAmount)}
          total={Number(quote.total)}
          depositAmount={quote.depositAmount != null ? Number(quote.depositAmount) : null}
          terms={quote.terms}
          warrantyMonths={quote.warrantyMonths}
          createdAt={quote.createdAt}
          expiresAt={quote.expiresAt}
        />
      )}

      <form action={approveFormAction} className="space-y-2">
        <Label htmlFor={`name-${quote.id}`}>Type your full name to approve</Label>
        <Input id={`name-${quote.id}`} name="name" placeholder="Your full name" />
        <p className="text-xs text-muted-foreground">By typing your name and approving, you accept this quote and its terms.</p>
        {approveState?.message && !approveState.ok && <p className="text-xs text-destructive">{approveState.message}</p>}
        <SubmitButton label="Approve quote" pendingLabel="Submitting…" />
      </form>

      <button type="button" onClick={() => setShowDecline((v) => !v)} className="text-xs text-muted-foreground underline">
        Not going ahead? Decline instead
      </button>
      {showDecline && (
        <form action={rejectFormAction} className="space-y-2">
          <Label htmlFor={`reason-${quote.id}`}>Reason (optional)</Label>
          <Textarea id={`reason-${quote.id}`} name="reason" rows={2} />
          {rejectState?.message && !rejectState.ok && <p className="text-xs text-destructive">{rejectState.message}</p>}
          <SubmitButton label="Decline quote" pendingLabel="Submitting…" variant="outline" />
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Need more work? — request a quote / book maintenance
// ---------------------------------------------------------------------------

function PortalRequestForm({
  token,
  kind,
  properties,
}: {
  token: string;
  kind: PortalRequestKind;
  properties: PortalHome["properties"];
}) {
  const action = submitPortalRequestAction.bind(null, token, kind);
  const [state, formAction] = useFormState<PortalActionState, FormData>(action, null);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        {state.message}
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        {kind === "maintenance" ? "Book maintenance" : "Request a quote"}
      </Button>
    );
  }

  function toggleWorkType(value: string) {
    setSelectedWorkTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border bg-muted/30 p-4">
      {selectedWorkTypes.map((w) => (
        <input key={w} type="hidden" name="workTypes" value={w} />
      ))}

      <div className="space-y-1.5">
        <Label>Property</Label>
        <Select name="propertyId" defaultValue={properties[0]?.id ?? ""}>
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
            <label key={t} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
              <Checkbox checked={selectedWorkTypes.includes(t)} onChange={() => toggleWorkType(t)} />
              {workTypeLabels[t]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{kind === "maintenance" ? "What needs a check?" : "Tell us what you need"}</Label>
        <Textarea name="description" rows={3} placeholder={kind === "maintenance" ? "e.g. bathroom silicone looking tired" : "e.g. new kitchen worktop upstand"} />
      </div>

      {state?.message && !state.ok && <p className="text-xs text-destructive">{state.message}</p>}
      <div className="flex gap-2">
        <SubmitButton label="Submit request" pendingLabel="Sending…" />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Contact details
// ---------------------------------------------------------------------------

function ContactForm({ token, customer }: { token: string; customer: PortalHome["customer"] }) {
  const action = updatePortalContactAction.bind(null, token);
  const [state, formAction] = useFormState<PortalActionState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" name="name" defaultValue={customer.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" defaultValue={customer.email ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">Phone</Label>
          <Input id="contact-phone" name="phone" type="tel" inputMode="tel" defaultValue={customer.phone ?? ""} />
        </div>
      </div>
      {state?.message && <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>}
      <SubmitButton label="Save details" pendingLabel="Saving…" variant="outline" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Message the business
// ---------------------------------------------------------------------------

function MessageForm({ token }: { token: string }) {
  const action = sendPortalMessageAction.bind(null, token);
  const [state, formAction] = useFormState<PortalActionState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-3">
      <Textarea name="message" rows={3} placeholder="Ask us anything…" />
      {state?.message && <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>}
      <SubmitButton label="Send message" pendingLabel="Sending…" variant="outline" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export function PortalHomeView({ token, home }: { token: string; home: PortalHome }) {
  return (
    <div className="space-y-6">
      {home.quotesAwaitingApproval.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-brand-plum" /> Action needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {home.quotesAwaitingApproval.map((q) => (
              <QuoteApprovalCard key={q.id} token={token} quote={q} />
            ))}
          </CardContent>
        </Card>
      )}

      {home.photoPairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 text-brand-plum" /> Before &amp; after
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {home.photoPairs.map((p) => (
              <div key={p.jobId} className="space-y-1.5">
                <BeforeAfterSlider beforeUrl={p.beforeUrl} afterUrl={p.afterUrl} />
                <p className="text-xs text-muted-foreground">
                  {p.jobNumber}
                  {p.completedAt ? ` · ${new Date(p.completedAt).toLocaleDateString("en-GB")}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileDown className="h-4 w-4 text-brand-plum" /> Your documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {home.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="space-y-2">
              {home.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString("en-GB")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{allDocumentCategoryLabels[d.category] ?? d.category}</Badge>
                    <a
                      href={`/api/portal/${token}/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                      aria-label={`Download ${d.name}`}
                    >
                      <FileDown className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-brand-plum" /> Need more work?
          </CardTitle>
        </CardHeader>
        <CardContent>
          {home.properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">Please contact us directly to arrange this.</p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <PortalRequestForm token={token} kind="quote" properties={home.properties} />
              <PortalRequestForm token={token} kind="maintenance" properties={home.properties} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-brand-plum" /> Your details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm token={token} customer={home.customer} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-brand-plum" /> Send us a message
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MessageForm token={token} />
        </CardContent>
      </Card>
    </div>
  );
}
