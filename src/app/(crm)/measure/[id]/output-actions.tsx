"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/lib/utils";
import type { TakeoffItemDetail } from "@/services/takeoff.service";

function buildListText(items: TakeoffItemDetail[], grandTotalGbp: number): string {
  const lines = items
    .filter((i) => i.totalMetres > 0)
    .map((i) => `${i.name} — ${i.totalMetres} m × ${formatGBP(Number(i.pricePerMetre))}/m = ${formatGBP(i.lineTotalGbp)}`);
  lines.push(`Total: ${formatGBP(grandTotalGbp)}`);
  return lines.join("\n");
}

function buildTableHtml(items: TakeoffItemDetail[], grandTotalGbp: number): string {
  const rows = items
    .filter((i) => i.totalMetres > 0)
    .map((i) => `<tr><td>${i.name}</td><td align="right">${i.totalMetres} m</td><td align="right">${formatGBP(Number(i.pricePerMetre))}</td><td align="right">${formatGBP(i.lineTotalGbp)}</td></tr>`)
    .join("");
  return `<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Item</th><th>Metres</th><th>£/m</th><th>Line total</th></tr></thead><tbody>${rows}<tr><td colspan="3"><b>Total</b></td><td align="right"><b>${formatGBP(grandTotalGbp)}</b></td></tr></tbody></table>`;
}

function buildTableText(items: TakeoffItemDetail[], grandTotalGbp: number): string {
  const rows = items
    .filter((i) => i.totalMetres > 0)
    .map((i) => `${i.name}\t${i.totalMetres} m\t${formatGBP(Number(i.pricePerMetre))}\t${formatGBP(i.lineTotalGbp)}`);
  return [`Item\tMetres\t£/m\tLine total`, ...rows, `Total\t\t\t${formatGBP(grandTotalGbp)}`].join("\n");
}

export function OutputActions({ takeoffId, items, grandTotalGbp }: { takeoffId: string; items: TakeoffItemDetail[]; grandTotalGbp: number }) {
  const [copied, setCopied] = useState<"list" | "table" | null>(null);

  async function copyList() {
    await navigator.clipboard.writeText(buildListText(items, grandTotalGbp));
    setCopied("list");
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyTable() {
    const html = buildTableHtml(items, grandTotalGbp);
    const text = buildTableText(items, grandTotalGbp);
    try {
      // Writing both text/html and text/plain means pasting into Word/
      // Outlook renders a real table, while a plain-text target (an email
      // compose box, a text editor) falls back to the tab-separated text.
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) }),
      ]);
    } catch {
      // Some browsers restrict multi-type clipboard writes outside a direct
      // user gesture context -- plain text still gets the data across.
      await navigator.clipboard.writeText(text);
    }
    setCopied("table");
    setTimeout(() => setCopied(null), 2000);
  }

  const hasMetres = items.some((i) => i.totalMetres > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
      <Button type="button" size="sm" variant="outline" disabled={!hasMetres} onClick={copyList}>
        {copied === "list" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy as list
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={!hasMetres} onClick={copyTable}>
        {copied === "table" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy as table
      </Button>
      <Button type="button" size="sm" disabled={!hasMetres} asChild>
        <Link href={`/quotes/new?takeoffId=${takeoffId}`}>
          <FileText className="h-3.5 w-3.5" /> Create quote from takeoff
        </Link>
      </Button>
    </div>
  );
}
