"use client";

import { RotateCcw } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { restoreJobAction, restoreQuoteAction, restoreInvoiceAction } from "./actions";

// No confirmation dialog on restore — it's the reversible "undo" for an
// accidental delete, so adding a second confirmation step just re-adds the
// friction soft-delete exists to remove.
const restoreProps = { label: "Restore", pendingLabel: "Restoring…", variant: "outline" as const, icon: <RotateCcw className="h-3.5 w-3.5" /> };

export function RestoreJobButton({ jobId }: { jobId: string }) {
  return <RecordActionButton {...restoreProps} action={() => restoreJobAction(jobId)} />;
}

export function RestoreQuoteButton({ quoteId }: { quoteId: string }) {
  return <RecordActionButton {...restoreProps} action={() => restoreQuoteAction(quoteId)} />;
}

export function RestoreInvoiceButton({ invoiceId }: { invoiceId: string }) {
  return <RecordActionButton {...restoreProps} action={() => restoreInvoiceAction(invoiceId)} />;
}
