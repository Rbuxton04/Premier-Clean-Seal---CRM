"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGBP } from "@/lib/utils";
import { CHART_PLUM, CHART_PLUM_TINT_1 } from "./palette";
import { ChartEmptyState } from "./empty-state";
import type { MonthlyRepeatRevenue } from "@/services/analytics.service";

function formatAxisGBP(v: number) {
  return `£${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;
}

export function RepeatRevenueChart({ data }: { data: MonthlyRepeatRevenue[] }) {
  const hasData = data.some((d) => d.newRevenue > 0 || d.repeatRevenue > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Repeat vs new revenue</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxisGBP} width={44} />
              <Tooltip formatter={(v: number) => formatGBP(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="newRevenue" stackId="1" stroke={CHART_PLUM_TINT_1} fill={CHART_PLUM_TINT_1} name="New customers" />
              <Area type="monotone" dataKey="repeatRevenue" stackId="1" stroke={CHART_PLUM} fill={CHART_PLUM} name="Repeat customers" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="Not enough completed jobs yet to chart repeat revenue." />
        )}
      </CardContent>
    </Card>
  );
}
