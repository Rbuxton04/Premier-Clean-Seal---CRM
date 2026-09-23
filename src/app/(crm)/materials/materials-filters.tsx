"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { productAttributes, productAttributeLabels } from "@/validators/product";
import type { ProductFilterOptions } from "@/services/materials.service";

export function MaterialsFilters({ options }: { options: ProductFilterOptions }) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const manufacturer = params.get("manufacturer") ?? "";
  const colour = params.get("colour") ?? "";
  const attribute = params.get("attribute") ?? "";
  const supplier = params.get("supplier") ?? "";
  const lowStockOnly = params.get("lowStockOnly") === "1";

  function pushParams(next: URLSearchParams) {
    router.replace(`/materials?${next.toString()}`);
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set(key, value);
    else next.delete(key);
    pushParams(next);
  }

  function toggleLowStockOnly() {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (lowStockOnly) next.delete("lowStockOnly");
    else next.set("lowStockOnly", "1");
    pushParams(next);
  }

  // Debounced search -- same pattern as customers/filter-bar.tsx.
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

  const hasFilters = Boolean(manufacturer || colour || attribute || supplier || lowStockOnly || q);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search manufacturer, name, colour, SKU…"
          aria-label="Search products"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Select value={manufacturer} onChange={(e) => setParam("manufacturer", e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by manufacturer">
        <option value="">All manufacturers</option>
        {options.manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
      </Select>

      <Select value={colour} onChange={(e) => setParam("colour", e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by colour">
        <option value="">All colours</option>
        {options.colours.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>

      <Select value={attribute} onChange={(e) => setParam("attribute", e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by attribute">
        <option value="">All attributes</option>
        {productAttributes.map((a) => <option key={a} value={a}>{productAttributeLabels[a]}</option>)}
      </Select>

      {options.suppliers.length > 0 && (
        <Select value={supplier} onChange={(e) => setParam("supplier", e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by supplier">
          <option value="">All suppliers</option>
          {options.suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      )}

      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={lowStockOnly} onChange={toggleLowStockOnly} /> Low stock only
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            router.replace("/materials");
          }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Clear filters
        </button>
      )}
    </div>
  );
}
