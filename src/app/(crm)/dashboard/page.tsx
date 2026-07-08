import Link from "next/link";
import { db } from "@/lib/db";
import { formatGBP } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { isAiConfigured } from "@/lib/ai";
import {
  revenueByMonth,
  jobsByMonth,
  leadConversion,
  topColours,
  topProducts,
  repeatRevenueByMonth,
} from "@/services/analytics.service";
import { getLatestInsightReport, getQuickStats } from "@/services/insight.service";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { MonthlyJobsChart } from "@/components/charts/monthly-jobs-chart";
import { LeadConversionChart } from "@/components/charts/lead-conversion-chart";
import { TopColoursChart } from "@/components/charts/top-colours-chart";
import { TopProductsChart } from "@/components/charts/top-products-chart";
import { RepeatRevenueChart } from "@/components/charts/repeat-revenue-chart";
import { GenerateInsightButton } from "../insights/generate-insight-button";

export const dynamic = "force-dynamic";

async function loadCharts(dbOnline: boolean) {
  if (!dbOnline) return null;
  try {
    const [revenue6, revenue12, jobsMonthly, conversion, colours, products, repeatRevenue] = await Promise.all([
      revenueByMonth(6),
      revenueByMonth(12),
      jobsByMonth(12),
      leadConversion(),
      topColours(8),
      topProducts(8),
      repeatRevenueByMonth(12),
    ]);
    return { revenue6, revenue12, jobsMonthly, conversion, colours, products, repeatRevenue };
  } catch {
    return null;
  }
}

async function loadInsightsPanel(dbOnline: boolean) {
  if (!dbOnline) return null;
  try {
    const [latest, quickStats] = await Promise.all([getLatestInsightReport(), getQuickStats()]);
    return { latest, quickStats };
  } catch {
    return null;
  }
}

type Kpi = { label: string; value: string; hint?: string };

async function loadKpis(): Promise<{ kpis: Kpi[]; dbOnline: boolean }> {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const startOfYear = new Date(startOfDay.getFullYear(), 0, 1);

  try {
    const [
      jobsToday, jobsThisWeek, newEnquiries, quotesAwaiting, activeJobs,
      completedJobs, followUpsDue, revenueMonth, revenueYear, avgJob,
    ] = await Promise.all([
      db.job.count({ where: { deletedAt: null, scheduledStart: { gte: startOfDay } , status: { in: ["BOOKED", "IN_PROGRESS"] } } }),
      db.job.count({ where: { deletedAt: null, scheduledStart: { gte: startOfWeek }, status: { in: ["BOOKED", "IN_PROGRESS"] } } }),
      db.enquiry.count({ where: { stage: "NEW" } }),
      db.quote.count({ where: { deletedAt: null, status: { in: ["SENT", "VIEWED"] } } }),
      db.job.count({ where: { deletedAt: null, status: "IN_PROGRESS" } }),
      db.job.count({ where: { deletedAt: null, status: "COMPLETED" } }),
      db.marketingReminder.count({ where: { status: "SCHEDULED", dueDate: { lte: new Date() } } }),
      db.invoice.aggregate({ _sum: { amount: true }, where: { deletedAt: null, paidAt: { gte: startOfMonth } } }),
      db.invoice.aggregate({ _sum: { amount: true }, where: { deletedAt: null, paidAt: { gte: startOfYear } } }),
      db.job.aggregate({ _avg: { price: true }, where: { deletedAt: null, status: "COMPLETED" } }),
    ]);

    return {
      dbOnline: true,
      kpis: [
        { label: "Jobs today", value: String(jobsToday) },
        { label: "Jobs this week", value: String(jobsThisWeek) },
        { label: "New enquiries", value: String(newEnquiries) },
        { label: "Quotes awaiting approval", value: String(quotesAwaiting) },
        { label: "Active jobs", value: String(activeJobs) },
        { label: "Completed jobs", value: String(completedJobs) },
        { label: "Customers due follow-up", value: String(followUpsDue) },
        { label: "Revenue this month", value: formatGBP(Number(revenueMonth._sum.amount ?? 0)) },
        { label: "Revenue this year", value: formatGBP(Number(revenueYear._sum.amount ?? 0)) },
        { label: "Average job value", value: formatGBP(Number(avgJob._avg.price ?? 0)) },
      ],
    };
  } catch {
    // Database not reachable yet — show the shell rather than crashing.
    return {
      dbOnline: false,
      kpis: [
        "Jobs today", "Jobs this week", "New enquiries", "Quotes awaiting approval",
        "Active jobs", "Completed jobs", "Customers due follow-up",
        "Revenue this month", "Revenue this year", "Average job value",
      ].map((label) => ({ label, value: "—" })),
    };
  }
}

export default async function DashboardPage() {
  const { kpis, dbOnline } = await loadKpis();
  const charts = await loadCharts(dbOnline);
  const insights = await loadInsightsPanel(dbOnline);
  const aiConfigured = isAiConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        {!dbOnline && (
          <div className="mt-3">
            <Badge variant="warning">
              Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
            </Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {charts && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RevenueChart data6={charts.revenue6} data12={charts.revenue12} />
          <MonthlyJobsChart data={charts.jobsMonthly} />
          <LeadConversionChart data={charts.conversion} />
          <RepeatRevenueChart data={charts.repeatRevenue} />
          <TopColoursChart data={charts.colours} />
          <TopProductsChart data={charts.products} />
        </div>
      )}

      {insights && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm">AI business insights</CardTitle>
            <GenerateInsightButton />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Due follow-up</p>
                <p className="font-display text-lg font-semibold">{insights.quickStats.dueFollowUpCount}</p>
              </div>
              <div className="rounded-lg border bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Likely to rebook</p>
                <p className="font-display text-lg font-semibold">{insights.quickStats.likelyToRebookCount}</p>
              </div>
            </div>

            {insights.latest ? (
              <div>
                <p className="text-xs text-muted-foreground">
                  {new Date(insights.latest.periodStart).toLocaleDateString("en-GB")} –{" "}
                  {new Date(insights.latest.periodEnd).toLocaleDateString("en-GB")}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{insights.latest.summary}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No report yet — generate the first one above.</p>
            )}

            {!aiConfigured && (
              <p className="text-xs text-muted-foreground">
                AI_API_KEY isn&apos;t set — reports use the computed stat summary above rather than a full AI narrative.
              </p>
            )}

            <Link href="/insights" className="inline-block text-xs font-medium text-primary hover:underline">
              View report history →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
