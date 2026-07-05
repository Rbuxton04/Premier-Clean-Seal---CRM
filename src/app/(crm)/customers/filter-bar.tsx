"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tag = { id: string; name: string; colour: string };

export function FilterBar({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const activeTags = params.getAll("tag");

  // Debounced search — pushes ?q= as you type.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (q) next.set("q", q); else next.delete("q");
      router.replace(`/customers?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggleTag(id: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    const current = next.getAll("tag");
    next.delete("tag");
    if (current.includes(id)) current.filter((t) => t !== id).forEach((t) => next.append("tag", t));
    else [...current, id].forEach((t) => next.append("tag", t));
    router.replace(`/customers?${next.toString()}`);
  }

  const hasFilters = q || activeTags.length > 0;

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company, contact or tag…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((t) => {
            const active = activeTags.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                  active ? "text-white border-transparent" : "text-foreground bg-background hover:bg-accent"
                )}
                style={active ? { backgroundColor: t.colour } : { borderColor: t.colour + "66" }}
              >
                {t.name}
              </button>
            );
          })}
          {hasFilters && (
            <button
              onClick={() => router.replace("/customers")}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
