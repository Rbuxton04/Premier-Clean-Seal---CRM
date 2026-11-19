"use client";

import { Trash2 } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { deleteTakeoffAction } from "../actions";

export function DeleteTakeoffButton({ id, name }: { id: string; name: string }) {
  return (
    <RecordActionButton
      label="Delete drawing"
      pendingLabel="Deleting…"
      variant="destructive"
      size="sm"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      confirmMessage={`Are you sure you want to delete ${name}? It will be hidden but can be restored by an admin.`}
      action={() => deleteTakeoffAction(id)}
      redirectTo="/drawings"
    />
  );
}
