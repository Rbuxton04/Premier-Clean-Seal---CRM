"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_PLUM_BRIGHT } from "./palette";
import { ChartEmptyState } from "./empty-state";
import type { MonthlyJobs } from "@/services/analytics.service";

export function MonthlyJobsChart({ data }: { data: MonthlyJobs[] }) {
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Monthly jobs</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_PLUM_BRIGHT} radius={[4, 4, 0, 0]} name="Jobs" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="No jobs logged yet." />
        )}
      </CardContent>
    </Card>
  );
}
