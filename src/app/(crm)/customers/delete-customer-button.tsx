"use client";

import { Trash2 } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { deleteCustomerAction } from "./actions";

export function DeleteCustomerButton({ customerId, customerName, redirectTo }: { customerId: string; customerName: string; redirectTo?: string }) {
  return (
    <RecordActionButton
      label="Delete"
      pendingLabel="Deleting…"
      variant="destructive"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      confirmMessage={`Delete ${customerName}? This hides the customer and all their properties, jobs, quotes, invoices, and warranties from normal use. Nothing is destroyed -- an admin can restore everything from Settings > Deleted items.`}
      action={() => deleteCustomerAction(customerId)}
      redirectTo={redirectTo}
    />
  );
}
