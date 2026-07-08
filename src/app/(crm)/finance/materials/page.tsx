import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP } from "@/lib/utils";
import { getMaterialsCostSummary, type MaterialsCostSummary } from "@/services/finance.service";
import { PeriodSelector } from "../period-selector";
import { parsePeriod } from "../parse-period";

export const dynamic = "force-dynamic";

async function loadSummary(searchParams: Record<string, string | string[] | undefined>): Promise<MaterialsCostSummary | null> {
  try {
    return await getMaterialsCostSummary(parsePeriod(searchParams));
  } catch {
    return null;
  }
}

export default async function FinanceMaterialsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const summary = await loadSummary(searchParams);
  const period = parsePeriod(searchParams);

  if (!summary) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load materials costs right now — try again shortly.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodSelector basePath="/finance/materials" current={period.preset} />
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total materials cost</p>
          <p className="font-display text-lg font-semibold">{formatGBP(summary.totalCost)}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cost by product ({period.label})</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.byProduct.length === 0 ? (
            <p className="text-sm text-muted-foreground">No material usage recorded in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity used</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byProduct.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell className="text-right">{row.totalQuantity}</TableCell>
                    <TableCell className="text-right font-medium">{formatGBP(row.totalCost)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold">{formatGBP(summary.totalCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            A rough cost-of-goods view from recorded material usage. Usage entries without a logged cost count as £0 here rather than being estimated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
