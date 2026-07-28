"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { paymentStatuses, paymentStatusLabels } from "@/validators/job";
import { invoicePeriodPresets, type InvoicePeriodPreset } from "./invoice-period";

type CustomerOption = { id: string; name: string; company: string | null };

const periodLabels: Record<Exclude<InvoicePeriodPreset, "custom">, string> = {
  all: "All time",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
};

export function InvoiceFilters({ customers }: { customers: CustomerOption[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const period = (invoicePeriodPresets.find((p) => p === params.get("period")) ?? "all") as InvoicePeriodPreset;
  const customerId = params.get("customerId") ?? "";
  const status = params.get("status") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [customFrom, setCustomFrom] = useState(params.get("from") ?? "");
  const [customTo, setCustomTo] = useState(params.get("to") ?? "");

  function pushParams(next: URLSearchParams): void {
    router.replace(`/invoices?${next.toString()}`);
  }

  function setParam(key: string, value: string): void {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set(key, value);
    else next.delete(key);
    pushParams(next);
  }

  function selectPeriod(preset: Exclude<InvoicePeriodPreset, "custom">): void {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("period", preset);
    next.delete("from");
    next.delete("to");
    pushParams(next);
  }

  function applyCustomRange(): void {
    if (!customFrom || !customTo) return;
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("period", "custom");
    next.set("from", customFrom);
    next.set("to", customTo);
    pushParams(next);
  }

  // Debounced search -- pushes ?q= as you type, same pattern as the
  // Customers page's filter bar (src/app/(crm)/customers/filter-bar.tsx).
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (q) next.set("q", q);
      else next.delete("q");
      pushParams(next);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = period !== "all" || Boolean(customerId) || Boolean(status) || Boolean(q);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(periodLabels) as Array<Exclude<InvoicePeriodPreset, "custom">>).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => selectPeriod(p)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                period === p ? "border-brand-plum bg-brand-plum text-white" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
        <div className={cn("flex flex-wrap items-center gap-1.5 rounded-full border px-2 py-1", period === "custom" && "border-brand-plum")}>
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-6 w-auto border-0 p-0 text-xs shadow-none"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-6 w-auto border-0 p-0 text-xs shadow-none"
            aria-label="To date"
          />
          <button type="button" onClick={applyCustomRange} className="rounded px-2 text-xs font-medium text-primary hover:underline">
            Apply
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search number, customer or amount…"
            aria-label="Search invoices"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <Select value={customerId} onChange={(e) => setParam("customerId", e.target.value)} className="h-9 w-auto max-w-[220px] text-sm" aria-label="Filter by customer">
          <option value="">All customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.company ? ` (${c.company})` : ""}
            </option>
          ))}
        </Select>

        <Select value={status} onChange={(e) => setParam("status", e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by status">
          <option value="">All statuses</option>
          {paymentStatuses.map((s) => (
            <option key={s} value={s}>
              {paymentStatusLabels[s]}
            </option>
          ))}
        </Select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setCustomFrom("");
              setCustomTo("");
              router.replace("/invoices");
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
