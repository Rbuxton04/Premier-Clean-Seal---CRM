"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function JobFilters({ technicians }: { technicians: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/jobs?${next.toString()}`);
  }

  return (
    <select
      value={params.get("technicianId") ?? ""}
      onChange={(e) => setParam("technicianId", e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">All technicians</option>
      {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}
