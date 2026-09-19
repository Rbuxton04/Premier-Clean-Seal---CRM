"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { certOwnerTypes, certOwnerTypeLabels, certStatuses, certStatusLabels } from "@/validators/certification";

export function CertificationFilters({ categories }: { categories: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const category = params.get("category") ?? "";
  const ownerType = params.get("ownerType") ?? "";
  const status = params.get("status") ?? "";
  const hasFilters = Boolean(category || ownerType || status);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/certifications?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={category} onChange={(e) => setParam("category", e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by category">
        <option value="">All categories</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>

      <Select value={ownerType} onChange={(e) => setParam("ownerType", e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by owner">
        <option value="">Business & person</option>
        {certOwnerTypes.map((t) => <option key={t} value={t}>{certOwnerTypeLabels[t]}</option>)}
      </Select>

      <Select value={status} onChange={(e) => setParam("status", e.target.value)} className="h-9 w-auto text-sm" aria-label="Filter by status">
        <option value="">All statuses</option>
        {certStatuses.map((s) => <option key={s} value={s}>{certStatusLabels[s]}</option>)}
      </Select>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.replace("/certifications")}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Clear filters
        </button>
      )}
    </div>
  );
}
