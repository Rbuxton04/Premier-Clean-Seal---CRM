"use client";

import { useState, useTransition } from "react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runRemindersNowAction } from "./actions";
import type { RunRemindersResult } from "@/services/marketing.service";

export function RunRemindersButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RunRemindersResult | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => setResult(await runRemindersNowAction()))}>
        <PlayCircle className="h-3.5 w-3.5" /> {pending ? "Running…" : "Run reminders now"}
      </Button>
      {result && (
        <p className="text-xs text-muted-foreground">
          {result.processed} due · {result.sent} sent · {result.cancelled} cancelled · {result.skipped} queued (no provider configured)
        </p>
      )}
    </div>
  );
}
