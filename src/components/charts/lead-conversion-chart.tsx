"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enquiryStageLabels } from "@/validators/enquiry";
import { CHART_PALETTE } from "./palette";
import { ChartEmptyState } from "./empty-state";
import type { LeadConversion } from "@/services/analytics.service";

export function LeadConversionChart({ data }: { data: LeadConversion }) {
  const hasData = data.totalEnquiries > 0;
  const chartData = data.funnel.map((f) => ({
    stage: enquiryStageLabels[f.stage as keyof typeof enquiryStageLabels] ?? f.stage,
    count: f.count,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Lead conversion</CardTitle>
        {hasData && <p className="text-xs text-muted-foreground">{data.conversionPct}% enquiry to job</p>}
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={110} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Enquiries">
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState message="No enquiries logged yet." />
        )}
      </CardContent>
    </Card>
  );
}
