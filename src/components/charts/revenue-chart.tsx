"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGBP } from "@/lib/utils";
import { CHART_PLUM, CHART_PLUM_BRIGHT } from "./palette";
import { ChartEmptyState } from "./empty-state";
import type { MonthlyRevenue } from "@/services/analytics.service";

function formatAxisGBP(v: number) {
  return `£${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;
}

export function RevenueChart({ data6, data12 }: { data6: MonthlyRevenue[]; data12: MonthlyRevenue[] }) {
  const [period, setPeriod] = useState<"6" | "12">("6");
  const data = period === "6" ? data6 : data12;
  const hasData = data.some((d) => d.revenue > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Revenue</CardTitle>
        <div className="flex gap-1">
          {(["6", "12"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                period === p ? "bg-brand-plum text-white" : "border text-muted-foreground hover:bg-accent"
              }`}
            >
              {p}mo
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_PLUM_BRIGHT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART_PLUM_BRIGHT} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxisGBP} width={44} />
              <Tooltip formatter={(v: number) => formatGBP(v)} />
              <Area type="monotone" dataKey="revenue" stroke={CHART_PLUM} fill="url(#revenueFill)" strokeWidth={2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="Not enough paid invoices yet to chart revenue." />
        )}
      </CardContent>
    </Card>
  );
}
