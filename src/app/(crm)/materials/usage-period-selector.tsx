"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FinancePeriodPreset } from "@/services/materials.service";

const presetLabels: Record<Exclude<FinancePeriodPreset, "custom">, string> = {
  month: "This month",
  quarter: "This quarter",
  year: "This year",
};

/** Independent of the catalogue's own search/filter params (usagePeriod/usageFrom/usageTo vs. q/manufacturer/...), so both can be set at once on the same hub page without fighting over query keys. */
export function UsagePeriodSelector({ current }: { current: FinancePeriodPreset }) {
  const router = useRouter();
  const params = useSearchParams();
  const [customFrom, setCustomFrom] = useState(params.get("usageFrom") ?? "");
  const [customTo, setCustomTo] = useState(params.get("usageTo") ?? "");

  function select(preset: Exclude<FinancePeriodPreset, "custom">) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("usagePeriod", preset);
    next.delete("usageFrom");
    next.delete("usageTo");
    router.replace(`/materials?${next.toString()}`);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("usagePeriod", "custom");
    next.set("usageFrom", customFrom);
    next.set("usageTo", customTo);
    router.replace(`/materials?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(presetLabels) as Array<Exclude<FinancePeriodPreset, "custom">>).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => select(p)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            current === p ? "border-brand-plum bg-brand-plum text-white" : "text-muted-foreground hover:bg-accent"
          )}
        >
          {presetLabels[p]}
        </button>
      ))}
      <div className={cn("flex flex-wrap items-center gap-1.5 rounded-full border px-2 py-1", current === "custom" && "border-brand-plum")}>
        <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-6 w-auto border-0 p-0 text-xs shadow-none" aria-label="From date" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-6 w-auto border-0 p-0 text-xs shadow-none" aria-label="To date" />
        <button type="button" onClick={applyCustom} className="rounded px-2 text-xs font-medium text-primary hover:underline">Apply</button>
      </div>
    </div>
  );
}
