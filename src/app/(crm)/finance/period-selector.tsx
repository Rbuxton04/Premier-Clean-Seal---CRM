import Link from "next/link";
import { cn } from "@/lib/utils";
import type { FinancePeriodPreset } from "@/services/finance.service";
import { CustomRangeForm } from "./custom-range-form";

const presets: Array<{ value: Exclude<FinancePeriodPreset, "custom">; label: string }> = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
];

export function PeriodSelector({
  basePath,
  current,
  extraParams = {},
}: {
  basePath: string;
  current: FinancePeriodPreset;
  extraParams?: Record<string, string | undefined>;
}) {
  function hrefFor(preset: string): string {
    const params = new URLSearchParams();
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set("period", preset);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Link
            key={p.value}
            href={hrefFor(p.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              current === p.value ? "border-brand-plum bg-brand-plum text-white" : "text-muted-foreground hover:bg-accent"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <CustomRangeForm basePath={basePath} extraParams={extraParams} active={current === "custom"} />
    </div>
  );
}
