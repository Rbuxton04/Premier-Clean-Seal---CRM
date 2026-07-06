"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateInsightNowAction } from "./actions";

export function GenerateInsightButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await generateInsightNowAction();
            setMessage(result.ok ? "Report generated." : (result.message ?? "Failed to generate report."));
          })
        }
      >
        <Sparkles className="h-3.5 w-3.5" /> {pending ? "Generating…" : "Generate now"}
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
