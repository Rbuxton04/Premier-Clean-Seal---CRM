import Link from "next/link";
import { Download, FileDown } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatGBP } from "@/lib/utils";
import { paymentStatusLabels } from "@/validators/job";
import { financeStatusFilterValues } from "@/validators/finance";
import { listFinanceInvoices, type FinanceInvoiceRow } from "@/services/finance.service";
import { PeriodSelector } from "../period-selector";
import { parsePeriod } from "../parse-period";

export const dynamic = "force-dynamic";

async function loadInvoices(
  searchParams: Record<string, string | string[] | undefined>
): Promise<{ rows: FinanceInvoiceRow[]; status?: string } | null> {
  try {
    const period = parsePeriod(searchParams);
    const statusParam = Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status;
    const status = financeStatusFilterValues.find((s) => s === statusParam);
    const rows = await listFinanceInvoices({ status, from: period.from, to: period.to });
    return { rows, status };
  } catch {
    return null;
  }
}

export default async function FinanceInvoicesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const data = await loadInvoices(searchParams);
  const period = parsePeriod(searchParams);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load the invoices ledger right now — try again shortly.</p>;
  }

  const extraParams = { status: data.status };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector basePath="/finance/invoices" current={period.preset} extraParams={extraParams} />
          <form method="get" className="flex items-center gap-1.5">
            <input type="hidden" name="period" value={period.preset} />
            {period.preset === "custom" && (
              <>
                <input type="hidden" name="from" value={searchParams.from as string | undefined} />
                <input type="hidden" name="to" value={searchParams.to as string | undefined} />
              </>
            )}
            <Select name="status" defaultValue={data.status ?? ""} className="h-8 w-auto text-xs">
              <option value="">All statuses</option>
              {financeStatusFilterValues.map((s) => (
                <option key={s} value={s}>{paymentStatusLabels[s]}</option>
              ))}
            </Select>
            <Button type="submit" size="sm" variant="outline">Filter</Button>
          </form>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={`/api/finance/invoices/export?${exportQuery(searchParams)}`}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        </Button>
      </div>

      {data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices match this period/filter.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((inv) => (
              <TableRow key={inv.id} className={inv.deletedAt ? "opacity-60" : undefined}>
                <TableCell className="font-medium">
                  {inv.invoiceNumber}
                  {inv.deletedAt && <Badge variant="outline" className="ml-2">Voided</Badge>}
                </TableCell>
                <TableCell>
                  <Link href={`/customers/${inv.customer.id}`} className="text-primary hover:underline">{inv.customer.name}</Link>
                </TableCell>
                <TableCell>
                  {inv.job ? <Link href={`/jobs/${inv.job.id}`} className="text-primary hover:underline">{inv.job.jobNumber}</Link> : "—"}
                </TableCell>
                <TableCell>{inv.createdAt.toLocaleDateString("en-GB")}</TableCell>
                <TableCell>{inv.dueDate.toLocaleDateString("en-GB")}</TableCell>
                <TableCell className="text-right">{formatGBP(Number(inv.subtotal))}</TableCell>
                <TableCell className="text-right">{formatGBP(Number(inv.vatAmount))}</TableCell>
                <TableCell className="text-right font-medium">{formatGBP(Number(inv.amount))}</TableCell>
                <TableCell>
                  <Badge variant="outline">{paymentStatusLabels[inv.status as keyof typeof paymentStatusLabels] ?? inv.status}</Badge>
                </TableCell>
                <TableCell>{inv.paidAt ? inv.paidAt.toLocaleDateString("en-GB") : "—"}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                      <FileDown className="h-3.5 w-3.5" /> PDF
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function exportQuery(searchParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  (["period", "from", "to", "status"] as const).forEach((key) => {
    const value = searchParams[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params.set(key, first);
  });
  return params.toString();
}
