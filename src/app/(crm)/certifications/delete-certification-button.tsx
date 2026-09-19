"use client";

import { Trash2 } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { deleteCertificationAction } from "./actions";

export function DeleteCertificationButton({ id, name }: { id: string; name: string }) {
  return (
    <RecordActionButton
      label="Delete"
      pendingLabel="Deleting…"
      variant="destructive"
      size="sm"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      confirmMessage={`Are you sure you want to delete ${name}? It will be hidden but can be restored by an admin.`}
      action={() => deleteCertificationAction(id)}
    />
  );
}
