"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateMaterialTubes, type MaterialDefaultsValues } from "@/validators/takeoff";
import type { TakeoffItemDetail } from "@/services/takeoff.service";

function buildRows(items: TakeoffItemDetail[], defaults: MaterialDefaultsValues) {
  return items
    .filter((i) => i.kind === "LENGTH" && i.totalMetres > 0)
    .map((item) => {
      const calc = calculateMaterialTubes(item.totalMetres, defaults, {
        jointWidthMm: item.overrideJointWidthMm,
        jointDepthMm: item.overrideJointDepthMm,
        wastePercent: item.overrideWastePercent,
      });
      return { item, calc };
    });
}

/**
 * Worst-case materials (Drawings Part 2, section 6) -- tubes to BUY, always
 * rounded up. A note disclaims this is for ordering, never the quoted
 * amount (the quote stays on measured metres, untouched by any of this).
 */
export function MaterialsPanel({ items, defaults }: { items: TakeoffItemDetail[]; defaults: MaterialDefaultsValues }) {
  const [copied, setCopied] = useState<"list" | "table" | null>(null);
  const rows = buildRows(items, defaults);
  const totalTubes = rows.reduce((sum, r) => sum + r.calc.tubesNeeded, 0);

  async function copyList() {
    const lines = rows.map(({ item, calc }) => `${item.name} — ${item.totalMetres}m, ${calc.jointWidthMm}x${calc.jointDepthMm}mm — ${calc.tubesNeeded} x ${calc.tubeMl}ml tubes`);
    lines.push(`Total tubes: ${totalTubes}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied("list");
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyTable() {
    const rowsText = rows.map(({ item, calc }) => `${item.name}\t${item.totalMetres}m\t${calc.jointWidthMm}x${calc.jointDepthMm}mm\t${calc.tubesNeeded} x ${calc.tubeMl}ml`);
    const text = [`Item\tMetres\tJoint\tTubes`, ...rowsText, `Total\t\t\t${totalTubes} tubes`].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied("table");
    setTimeout(() => setCopied(null), 2000);
  }

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No LENGTH items with any metres measured yet.</p>;
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">
        Worst-case estimate for ordering tubes -- always rounded up, never the quoted amount (the quote stays on
        measured metres).
      </p>
      <ul className="space-y-1.5">
        {rows.map(({ item, calc }) => (
          <li key={item.id} className="flex items-center gap-2 text-xs" title={calc.workingText}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.colour }} />
            <span className="flex-1 truncate">{item.name}</span>
            <span className="text-muted-foreground">
              {calc.jointWidthMm}x{calc.jointDepthMm}mm{calc.widthIsDefault && calc.depthIsDefault ? " (default)" : " (custom)"}
            </span>
            <span className="font-medium">{calc.tubesNeeded} x {calc.tubeMl}ml</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t pt-2">
        <span className="font-medium">Total tubes</span>
        <span className="font-display text-base font-semibold text-brand-plum">{totalTubes}</span>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copyList}>
          {copied === "list" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy as list
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={copyTable}>
          {copied === "table" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy as table
        </Button>
      </div>
    </div>
  );
}
