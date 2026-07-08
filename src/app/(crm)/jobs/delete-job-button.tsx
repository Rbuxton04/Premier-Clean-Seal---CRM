"use client";

import { Trash2 } from "lucide-react";
import { RecordActionButton } from "@/components/record-action-button";
import { deleteJobAction } from "./actions";

export function DeleteJobButton({ jobId, jobNumber, redirectTo }: { jobId: string; jobNumber: string; redirectTo?: string }) {
  return (
    <RecordActionButton
      label="Delete"
      pendingLabel="Deleting…"
      variant="destructive"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      confirmMessage={`Are you sure you want to delete job ${jobNumber}? It will be hidden but can be restored by an admin.`}
      action={() => deleteJobAction(jobId)}
      redirectTo={redirectTo}
    />
  );
}
