"use client";

import { Trash2 } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { deleteQuoteAction } from "./actions";

export function DeleteQuoteButton({ quoteId, quoteNumber, redirectTo }: { quoteId: string; quoteNumber: string; redirectTo?: string }) {
  return (
    <RecordActionButton
      label="Delete"
      pendingLabel="Deleting…"
      variant="destructive"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      confirmMessage={`Are you sure you want to delete quote ${quoteNumber}? It will be hidden but can be restored by an admin.`}
      action={() => deleteQuoteAction(quoteId)}
      redirectTo={redirectTo}
    />
  );
}
