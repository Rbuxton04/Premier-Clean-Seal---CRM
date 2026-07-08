"use client";

import { Trash2 } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { deleteInvoiceAction } from "./actions";

/**
 * Labelled "Void / delete" per the invoice retention note — invoices are
 * financial records that generally must be retained (UK: ~6 years), so
 * this only ever hides the invoice (soft-delete), never erases it. Not
 * legal advice — the operator manages retention.
 */
export function DeleteInvoiceButton({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  return (
    <RecordActionButton
      label="Void / delete"
      pendingLabel="Voiding…"
      variant="destructive"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      confirmMessage={`Are you sure you want to void/delete invoice ${invoiceNumber}? It will be hidden but can be restored by an admin. The invoice number will not be reused.`}
      action={() => deleteInvoiceAction(invoiceId)}
    />
  );
}
