"use client";

import { Trash2 } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { deleteProductAction } from "./actions";

export function DeleteProductButton({ id, label }: { id: string; label: string }) {
  return (
    <RecordActionButton
      label="Delete"
      pendingLabel="Deleting…"
      variant="destructive"
      size="sm"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      confirmMessage={`Are you sure you want to delete ${label}? It will be hidden from the catalogue but can be restored by an admin, and its usage history is kept.`}
      action={() => deleteProductAction(id)}
    />
  );
}
