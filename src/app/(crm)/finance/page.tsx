import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatGBP } from "@/lib/utils";
import { getFinanceOverview, type FinanceOverview } from "@/services/finance.service";
import { PeriodSelector } from "./period-selector";
import { parsePeriod } from "./parse-period";

export const dynamic = "force-dynamic";

async function loadOverview(searchParams: Record<string, string | string[] | undefined>): Promise<FinanceOverview | null> {
  try {
    return await getFinanceOverview(parsePeriod(searchParams));
  } catch {
    return null;
  }
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function FinanceOverviewPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const overview = await loadOverview(searchParams);

  if (!overview) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load finance figures right now — try again shortly.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodSelector basePath="/finance" current={overview.period.preset} />
        <Button asChild size="sm" variant="outline">
          <a href={`/api/finance/summary/export?${exportQuery(searchParams)}`}>
            <Download className="h-3.5 w-3.5" /> Export summary CSV
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total invoiced" value={formatGBP(overview.totalInvoiced)} hint={overview.period.label} />
        <StatCard label="Total paid" value={formatGBP(overview.totalPaid)} hint={overview.period.label} />
        <StatCard label="Total outstanding" value={formatGBP(overview.totalOutstanding)} hint="Current position" />
        <StatCard label="Overdue" value={formatGBP(overview.overdueAmount)} hint="Current position" />
        <StatCard label="Average job value" value={formatGBP(overview.avgJobValue)} hint={overview.period.label} />
        <StatCard label="Deposits held" value={formatGBP(overview.depositsHeld)} hint="Current position" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue by month</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {overview.revenueByMonth.map((m) => (
                <li key={m.month} className="flex items-center justify-between border-b pb-1 last:border-0">
                  <span className="text-muted-foreground">{m.month}</span>
                  <span className="font-medium">{formatGBP(m.revenue)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">VAT summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.vat.registered ? (
              <Badge variant="success">Registered — {overview.vat.ratePercent}%</Badge>
            ) : (
              <Badge variant="warning">Not registered — £0 VAT</Badge>
            )}
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Net ({overview.period.label})</span>
                <span className="font-medium">{formatGBP(overview.vat.netInPeriod)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">VAT ({overview.period.label})</span>
                <span className="font-medium">{formatGBP(overview.vat.vatInPeriod)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-1.5 font-medium">
                <span>Gross ({overview.period.label})</span>
                <span className="text-brand-plum">{formatGBP(overview.vat.grossInPeriod)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {overview.vat.registered
                ? "Figures reflect the VAT rate in effect when each invoice was issued."
                : "Premier Clean & Seal isn't VAT registered yet, so VAT is £0 on every invoice. This summary is ready to show real figures the moment that changes — see the VAT tab for more."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function exportQuery(searchParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  (["period", "from", "to"] as const).forEach((key) => {
    const value = searchParams[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params.set(key, first);
  });
  return params.toString();
}
