"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, FileDown, Wrench, Copy, Check, Ruler } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { sendQuoteAction, convertToJobAction } from "../actions";
import type { SendQuoteResult } from "@/services/quote.service";

export function QuoteActions({
  quoteId,
  customerId,
  status,
  pdfHref,
  existingJobId,
  linkedTakeoffs = [],
}: {
  quoteId: string;
  customerId: string;
  status: string;
  pdfHref: string;
  existingJobId?: string | null;
  linkedTakeoffs?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [convertPending, startConvertTransition] = useTransition();
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
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={pdfHref.replace(/\/pdf$/, "/docx")} target="_blank" rel="noreferrer">
            <FileDown className="h-3.5 w-3.5" /> Download Word
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href={`/drawings/new?customerId=${customerId}&quoteId=${quoteId}`}>
            <Ruler className="h-3.5 w-3.5" /> New drawing
          </Link>
        </Button>
        {linkedTakeoffs.map((t) => (
          <Button key={t.id} type="button" size="sm" variant="outline" asChild>
            <Link href={`/drawings/${t.id}`}>
              <Ruler className="h-3.5 w-3.5" /> Open in Drawings ({t.name})
            </Link>
          </Button>
        ))}
        {linkedTakeoffs.map((t) => (
          <Button key={`${t.id}-export`} type="button" size="sm" variant="outline" asChild>
            <a href={`/api/drawings/${t.id}/export`}>
              Download marked-up plan ({t.name})
            </a>
          </Button>
        ))}
        {existingJobId ? (
          <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/jobs/${existingJobId}`)}>
            <Wrench className="h-3.5 w-3.5" /> View job
          </Button>
        ) : status === "APPROVED" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={convertPending}
            onClick={() =>
              startConvertTransition(async () => {
                const { jobId } = await convertToJobAction(quoteId);
                router.push(`/jobs/${jobId}`);
              })
            }
          >
            <Wrench className="h-3.5 w-3.5" /> {convertPending ? "Converting…" : "Convert to job"}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled className="opacity-70">
            <Wrench className="h-3.5 w-3.5" /> Convert to job — needs an approved quote
          </Button>
        )}
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
