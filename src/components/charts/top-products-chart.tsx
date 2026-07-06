"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_PLUM_TINT_2, CHART_PLUM } from "./palette";
import { ChartEmptyState } from "./empty-state";
import type { ProductUsage } from "@/services/analytics.service";

export function TopProductsChart({ data }: { data: ProductUsage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Top products used</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="product" tick={{ fontSize: 10 }} width={140} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_PLUM_TINT_2} stroke={CHART_PLUM} radius={[0, 4, 4, 0]} name="Used" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="No materials logged yet." />
        )}
      </CardContent>
    </Card>
  );
}
