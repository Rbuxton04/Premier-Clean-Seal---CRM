"use client";

import { Trash2 } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { deletePropertyAction } from "../actions";

export function DeletePropertyButton({ customerId, propertyId, address }: { customerId: string; propertyId: string; address: string }) {
  return (
    <RecordActionButton
      label="Delete"
      pendingLabel="Deleting…"
      variant="ghost"
      size="sm"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      confirmMessage={`Delete ${address}? It will be hidden but can be restored by an admin, and its work-log history is kept.`}
      action={() => deletePropertyAction(customerId, propertyId)}
    />
  );
}
