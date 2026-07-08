import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP } from "@/lib/utils";
import { quoteStatusLabels } from "@/validators/quote";
import { jobStatusLabels } from "@/validators/job";
import { getQuoteValueSummary, getJobValueSummary, type QuoteValueSummary, type JobValueSummary } from "@/services/finance.service";
import { PeriodSelector } from "../period-selector";
import { parsePeriod } from "../parse-period";

export const dynamic = "force-dynamic";

async function loadSummaries(
  searchParams: Record<string, string | string[] | undefined>
): Promise<{ quotes: QuoteValueSummary; jobs: JobValueSummary } | null> {
  try {
    const period = parsePeriod(searchParams);
    const [quotes, jobs] = await Promise.all([getQuoteValueSummary(period), getJobValueSummary(period)]);
    return { quotes, jobs };
  } catch {
    return null;
  }
}

export default async function FinanceQuotesJobsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const data = await loadSummaries(searchParams);
  const period = parsePeriod(searchParams);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load quote/job values right now — try again shortly.</p>;
  }

  return (
    <div className="space-y-6">
      <PeriodSelector basePath="/finance/quotes-jobs" current={period.preset} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quotes by status ({period.label})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.quotes.byStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotes in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Total value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.quotes.byStatus.map((row) => (
                    <TableRow key={row.status}>
                      <TableCell>{quoteStatusLabels[row.status as keyof typeof quoteStatusLabels] ?? row.status}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right font-medium">{formatGBP(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold">{data.quotes.totalCount}</TableCell>
                    <TableCell className="text-right font-semibold">{formatGBP(data.quotes.totalValue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Jobs by status ({period.label})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.jobs.byStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Total value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.jobs.byStatus.map((row) => (
                    <TableRow key={row.status}>
                      <TableCell>{jobStatusLabels[row.status as keyof typeof jobStatusLabels] ?? row.status}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right font-medium">{formatGBP(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold">{data.jobs.totalCount}</TableCell>
                    <TableCell className="text-right font-semibold">{formatGBP(data.jobs.totalValue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
