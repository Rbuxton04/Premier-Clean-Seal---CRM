"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_PLUM_TINT_1 } from "./palette";
import { ChartEmptyState } from "./empty-state";
import type { ColourUsage } from "@/services/analytics.service";

export function TopColoursChart({ data }: { data: ColourUsage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Top silicone colours</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="colour" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v: number, _name: string, p: { payload?: ColourUsage }) => [`${v} uses (${p.payload?.pct ?? 0}%)`, "Used"]} />
              <Bar dataKey="count" fill={CHART_PLUM_TINT_1} radius={[0, 4, 4, 0]} name="Used" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="No materials logged yet." />
        )}
      </CardContent>
    </Card>
  );
}
