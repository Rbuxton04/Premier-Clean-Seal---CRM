"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, Copy, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { sendPortalLinkAction, revokePortalTokenAction, type SendPortalLinkState } from "../actions";
import type { PortalTokenSummary } from "@/services/portal.service";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Send className="h-3.5 w-3.5" /> {pending ? "Sending…" : "Send portal link"}
    </Button>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function PortalPanel({ customerId, tokens }: { customerId: string; tokens: PortalTokenSummary[] }) {
  const action = sendPortalLinkAction.bind(null, customerId);
  const [state, formAction] = useFormState<SendPortalLinkState, FormData>(action, null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="expiryDays">Link expires after (days)</Label>
          <Input id="expiryDays" name="expiryDays" type="number" min={7} max={365} defaultValue={60} className="w-32" />
        </div>
        <SubmitButton />
      </form>

      {state && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <p className="mb-1 text-muted-foreground">{state.message}</p>
          {state.url && (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1">{state.url}</code>
              <CopyButton url={state.url} />
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portal links</p>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No portal links yet.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={t.revoked ? "outline" : "success"}>{t.revoked ? "Revoked/expired" : "Active"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {t.revoked ? "Expired" : "Expires"} {new Date(t.expiresAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <code className="mt-1 block truncate text-xs text-muted-foreground">{t.url}</code>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton url={t.url} />
                  {!t.revoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => startTransition(() => revokePortalTokenAction(customerId, t.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
