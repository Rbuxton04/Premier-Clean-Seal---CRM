import { db } from "@/lib/db";
import { formatGBP } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

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
      db.job.count({ where: { scheduledStart: { gte: startOfDay } , status: { in: ["BOOKED", "IN_PROGRESS"] } } }),
      db.job.count({ where: { scheduledStart: { gte: startOfWeek }, status: { in: ["BOOKED", "IN_PROGRESS"] } } }),
      db.enquiry.count({ where: { stage: "NEW" } }),
      db.quote.count({ where: { status: { in: ["SENT", "VIEWED"] } } }),
      db.job.count({ where: { status: "IN_PROGRESS" } }),
      db.job.count({ where: { status: "COMPLETED" } }),
      db.marketingReminder.count({ where: { status: "SCHEDULED", dueDate: { lte: new Date() } } }),
      db.invoice.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfMonth } } }),
      db.invoice.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfYear } } }),
      db.job.aggregate({ _avg: { price: true }, where: { status: "COMPLETED" } }),
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Charts</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Revenue, monthly jobs, lead conversion, top colours and top products land in Milestone 9,
          once real quote and job data is flowing through the pipeline.
        </CardContent>
      </Card>
    </div>
  );
}
