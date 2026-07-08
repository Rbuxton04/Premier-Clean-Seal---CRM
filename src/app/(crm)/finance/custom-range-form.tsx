"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CustomRangeForm({
  basePath,
  extraParams = {},
  active,
}: {
  basePath: string;
  extraParams?: Record<string, string | undefined>;
  active: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function submit(): void {
    if (!from || !to) return;
    const params = new URLSearchParams();
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set("period", "custom");
    params.set("from", from);
    params.set("to", to);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 rounded-full border px-2 py-1", active && "border-brand-plum")}>
      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-6 w-auto border-0 p-0 text-xs shadow-none" aria-label="From date" />
      <span className="text-xs text-muted-foreground">–</span>
      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-6 w-auto border-0 p-0 text-xs shadow-none" aria-label="To date" />
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={submit}>
        Apply
      </Button>
    </div>
  );
}
