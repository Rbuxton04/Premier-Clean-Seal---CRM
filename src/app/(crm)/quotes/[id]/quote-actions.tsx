"use client";

import { useState, useTransition } from "react";
import { Send, FileDown, Wrench, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendQuoteAction } from "../actions";
import type { SendQuoteResult } from "@/services/quote.service";

export function QuoteActions({ quoteId, status, pdfHref }: { quoteId: string; status: string; pdfHref: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SendQuoteResult | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => setResult(await sendQuoteAction(quoteId)))}
        >
          <Send className="h-3.5 w-3.5" /> {pending ? "Sending…" : status === "DRAFT" ? "Send to customer" : "Resend"}
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={pdfHref} target="_blank" rel="noreferrer">
            <FileDown className="h-3.5 w-3.5" /> Download PDF
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" disabled className="opacity-70">
          <Wrench className="h-3.5 w-3.5" /> Convert to job — Milestone 5
        </Button>
      </div>

      {result && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <p className="mb-1 text-muted-foreground">
            {result.emailed ? "Emailed to the customer." : "Email isn't configured yet — share this link with the customer:"}
          </p>
          {!result.emailed && (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1">{result.approvalUrl}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result.approvalUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1 text-primary"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
