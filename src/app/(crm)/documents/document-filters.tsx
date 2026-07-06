"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { allDocumentCategoryLabels } from "@/validators/media";

export function DocumentFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  // Debounced search — pushes ?q= as you type, matching the customers list pattern.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (q) next.set("q", q);
      else next.delete("q");
      router.replace(`/documents?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setCategory(value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set("category", value);
    else next.delete("category");
    router.replace(`/documents?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, customer or job…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Select value={params.get("category") ?? ""} onChange={(e) => setCategory(e.target.value)} className="w-auto">
        <option value="">All categories</option>
        {Object.entries(allDocumentCategoryLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
