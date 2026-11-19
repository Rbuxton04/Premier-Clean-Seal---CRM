"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, FileText, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/lib/utils";
import type { TakeoffItemDetail } from "@/services/takeoff.service";

/** A LENGTH item's quantity is its metres; a COUNT item's is its marker count -- see TakeoffItemDetail.count. */
function quantityOf(item: TakeoffItemDetail): number {
  return item.kind === "COUNT" ? item.count : item.totalMetres;
}
function hasQuantity(item: TakeoffItemDetail): boolean {
  return quantityOf(item) > 0;
}
function quantityLabel(item: TakeoffItemDetail): string {
  return item.kind === "COUNT" ? `${item.count}` : `${item.totalMetres} m`;
}
function rateLabel(item: TakeoffItemDetail): string {
  return item.kind === "COUNT" ? `${formatGBP(Number(item.pricePerMetre))}/item` : `${formatGBP(Number(item.pricePerMetre))}/m`;
}

function buildListText(items: TakeoffItemDetail[], grandTotalGbp: number): string {
  const lines = items.filter(hasQuantity).map((i) => `${i.name} — ${quantityLabel(i)} × ${rateLabel(i)} = ${formatGBP(i.lineTotalGbp)}`);
  lines.push(`Total: ${formatGBP(grandTotalGbp)}`);
  return lines.join("\n");
}

function buildTableHtml(items: TakeoffItemDetail[], grandTotalGbp: number): string {
  const rows = items
    .filter(hasQuantity)
    .map((i) => `<tr><td>${i.name}</td><td align="right">${quantityLabel(i)}</td><td align="right">${rateLabel(i)}</td><td align="right">${formatGBP(i.lineTotalGbp)}</td></tr>`)
    .join("");
  return `<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Line total</th></tr></thead><tbody>${rows}<tr><td colspan="3"><b>Total</b></td><td align="right"><b>${formatGBP(grandTotalGbp)}</b></td></tr></tbody></table>`;
}

function buildTableText(items: TakeoffItemDetail[], grandTotalGbp: number): string {
  const rows = items.filter(hasQuantity).map((i) => `${i.name}\t${quantityLabel(i)}\t${rateLabel(i)}\t${formatGBP(i.lineTotalGbp)}`);
  return [`Item\tQty\tRate\tLine total`, ...rows, `Total\t\t\t${formatGBP(grandTotalGbp)}`].join("\n");
}

export function OutputActions({ takeoffId, items, grandTotalGbp }: { takeoffId: string; items: TakeoffItemDetail[]; grandTotalGbp: number }) {
  const [copied, setCopied] = useState<"list" | "table" | null>(null);
  const [exportPrices, setExportPrices] = useState(true);
  const [exportPages, setExportPages] = useState<"measured" | "all">("measured");

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

  const hasQuantities = items.some(hasQuantity);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
      <Button type="button" size="sm" variant="outline" disabled={!hasQuantities} onClick={copyList}>
        {copied === "list" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy as list
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={!hasQuantities} onClick={copyTable}>
        {copied === "table" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy as table
      </Button>
      <Button type="button" size="sm" disabled={!hasQuantities} asChild>
        <Link href={`/quotes/new?takeoffId=${takeoffId}`}>
          <FileText className="h-3.5 w-3.5" /> Create quote from takeoff
        </Link>
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={exportPrices} onChange={(e) => setExportPrices(e.target.checked)} /> Prices
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={exportPages === "all"} onChange={(e) => setExportPages(e.target.checked ? "all" : "measured")} /> All pages
      </label>
      <Button type="button" size="sm" variant="outline" disabled={!hasQuantities} asChild>
        <a href={`/api/takeoffs/${takeoffId}/export?prices=${exportPrices ? "1" : "0"}&pages=${exportPages}`}>
          <Download className="h-3.5 w-3.5" /> Download marked-up plan
        </a>
      </Button>
    </div>
  );
}
