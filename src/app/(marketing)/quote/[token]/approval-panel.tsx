"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatGBP } from "@/lib/utils";
import { approveQuoteAction, rejectQuoteAction, type ApprovalFormState } from "./actions";

function SubmitButton({ label, variant }: { label: string; variant?: "default" | "outline" }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending}>{pending ? "Submitting…" : label}</Button>;
}

export function ApprovalPanel({ token, status, depositAmount }: { token: string; status: string; depositAmount: number | null }) {
  const approveAction = approveQuoteAction.bind(null, token);
  const rejectAction = rejectQuoteAction.bind(null, token);
  const [approveState, approveFormAction] = useFormState<ApprovalFormState, FormData>(approveAction, null);
  const [rejectState, rejectFormAction] = useFormState<ApprovalFormState, FormData>(rejectAction, null);
  const [showReject, setShowReject] = useState(false);

  if (status === "EXPIRED") {
    return (
      <p className="rounded-md border bg-muted/30 p-4 text-sm">
        This quote has expired. Please get in touch and we&apos;ll send you an updated one.
      </p>
    );
  }
  if (status === "APPROVED" || approveState?.ok) {
    return (
      <p className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        You&apos;ve approved this quote — thank you. We&apos;ll be in touch to arrange the work.
      </p>
    );
  }
  if (status === "REJECTED" || rejectState?.ok) {
    return (
      <p className="rounded-md border bg-muted/30 p-4 text-sm">
        This quote was declined. If that was a mistake, please get in touch.
      </p>
    );
  }

  return (
    <div className="space-y-5 rounded-lg border p-4">
      {depositAmount ? (
        <div className="rounded-md bg-muted/30 p-3">
          <p className="text-sm font-medium">Deposit due on approval: {formatGBP(depositAmount)}</p>
          <Button type="button" variant="outline" size="sm" disabled className="mt-2 opacity-70">
            Pay deposit — card payments coming soon
          </Button>
        </div>
      ) : null}

      <form action={approveFormAction} className="space-y-2">
        <Label htmlFor="name">Type your full name to approve</Label>
        <Input id="name" name="name" placeholder="Your full name" />
        <p className="text-xs text-muted-foreground">
          By typing your name and approving, you accept this quote and its terms. This is a reasonable electronic
          acceptance for a trade quote, not a formal qualified e-signature.
        </p>
        {approveState?.message && !approveState.ok && <p className="text-xs text-destructive">{approveState.message}</p>}
        <SubmitButton label="Approve quote" />
      </form>

      <button type="button" onClick={() => setShowReject((v) => !v)} className="text-xs text-muted-foreground underline">
        Not going ahead? Decline instead
      </button>
      {showReject && (
        <form action={rejectFormAction} className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Textarea id="reason" name="reason" rows={2} />
          {rejectState?.message && !rejectState.ok && <p className="text-xs text-destructive">{rejectState.message}</p>}
          <SubmitButton label="Decline quote" variant="outline" />
        </form>
      )}
    </div>
  );
}
