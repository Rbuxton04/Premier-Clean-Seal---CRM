import Link from "next/link";
import { Download } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/lib/utils";
import { paymentStatusLabels } from "@/validators/job";
import { getOutstanding, type OutstandingSummary } from "@/services/finance.service";

export const dynamic = "force-dynamic";

async function loadOutstanding(): Promise<OutstandingSummary | null> {
  try {
    return await getOutstanding();
  } catch {
    return null;
  }
}

export default async function FinanceOutstandingPage() {
  const summary = await loadOutstanding();

  if (!summary) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load outstanding balances right now — try again shortly.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unpaid invoices</p>
            <p className="font-display text-lg font-semibold">{formatGBP(summary.totalOutstanding)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Job balances due</p>
            <p className="font-display text-lg font-semibold">{formatGBP(summary.totalBalanceDue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Deposits held</p>
            <p className="font-display text-lg font-semibold">{formatGBP(summary.depositsHeld)}</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href="/api/finance/outstanding/export">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Unpaid &amp; overdue invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding — every invoice is paid.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>
                      <Link href={`/customers/${inv.customer.id}`} className="text-primary hover:underline">{inv.customer.name}</Link>
                    </TableCell>
                    <TableCell>{inv.dueDate.toLocaleDateString("en-GB")}</TableCell>
                    <TableCell className="text-right font-medium">{formatGBP(Number(inv.amount))}</TableCell>
                    <TableCell>
                      <Badge variant={inv.overdue ? "warning" : "outline"}>
                        {inv.overdue ? "Overdue" : paymentStatusLabels[inv.status as keyof typeof paymentStatusLabels] ?? inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Jobs with a balance due</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.jobsWithBalance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs currently show a balance due.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Deposit paid</TableHead>
                  <TableHead className="text-right">Balance due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.jobsWithBalance.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      <Link href={`/jobs/${job.id}`} className="text-primary hover:underline">{job.jobNumber}</Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/customers/${job.customer.id}`} className="text-primary hover:underline">{job.customer.name}</Link>
                    </TableCell>
                    <TableCell className="text-right">{formatGBP(Number(job.price))}</TableCell>
                    <TableCell className="text-right">{formatGBP(Number(job.depositPaid))}</TableCell>
                    <TableCell className="text-right font-medium">{formatGBP(Number(job.balanceDue))}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{paymentStatusLabels[job.paymentStatus as keyof typeof paymentStatusLabels] ?? job.paymentStatus}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
