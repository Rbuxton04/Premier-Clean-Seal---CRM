import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP } from "@/lib/utils";
import type { MaterialsUsageSummary } from "@/services/materials.service";
import { UsagePeriodSelector } from "./usage-period-selector";

export function UsageReport({ summary }: { summary: MaterialsUsageSummary }) {
  const topByQuantity = [...summary.byProduct].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 8);
  const maxQuantity = Math.max(1, ...topByQuantity.map((p) => p.totalQuantity));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <UsagePeriodSelector current={summary.period.preset} />
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total materials spend ({summary.period.label})</p>
          <p className="font-display text-lg font-semibold">{formatGBP(summary.totalSpend)}</p>
        </div>
      </div>

      {summary.byProduct.length === 0 ? (
        <p className="text-sm text-muted-foreground">No material usage recorded in this period.</p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top products by usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {topByQuantity.map((p) => (
                <div key={p.productId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{p.manufacturer} {p.name} ({p.colour})</span>
                    <span className="shrink-0 text-muted-foreground">{p.totalQuantity} {p.unit}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand-plum" style={{ width: `${(p.totalQuantity / maxQuantity) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cost by product</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity used</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.byProduct.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell>
                        <details>
                          <summary className="cursor-pointer select-none text-sm">
                            {p.manufacturer} {p.name} ({p.colour})
                          </summary>
                          <ul className="mt-2 space-y-1 border-l pl-3 text-xs text-muted-foreground">
                            {p.entries.map((e) => (
                              <li key={e.usageId}>
                                <Link href={`/jobs/${e.jobId}`} className="text-primary hover:underline">{e.jobNumber}</Link>
                                {" "}— {e.customerName}, {new Date(e.visitDate).toLocaleDateString("en-GB")}: {e.quantityUsed} {e.unit}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </TableCell>
                      <TableCell className="text-right">{p.totalQuantity} {p.unit}</TableCell>
                      <TableCell className="text-right font-medium">{formatGBP(p.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold">{formatGBP(summary.totalSpend)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                Uses the cost recorded on each usage entry where available, otherwise estimates quantity used times the product&apos;s current unit cost.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
