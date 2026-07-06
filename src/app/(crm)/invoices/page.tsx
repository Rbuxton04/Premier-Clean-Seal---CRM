import Link from "next/link";
import { FileDown } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP } from "@/lib/utils";
import { listInvoices } from "@/services/invoice.service";
import { paymentStatusLabels } from "@/validators/job";
import type { InvoiceListItem } from "@/services/invoice.service";

export const dynamic = "force-dynamic";

async function loadInvoices() {
  try {
    return { invoices: await listInvoices(), dbOnline: true };
  } catch {
    return { invoices: [] as InvoiceListItem[], dbOnline: false };
  }
}

export default async function InvoicesPage() {
  const { invoices, dbOnline } = await loadInvoices();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Invoices</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet — these are raised automatically when a job is completed.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>
                    <Link href={`/customers/${inv.customer.id}`} className="text-primary hover:underline">{inv.customer.name}</Link>
                  </TableCell>
                  <TableCell>
                    {inv.job ? <Link href={`/jobs/${inv.job.id}`} className="text-primary hover:underline">{inv.job.jobNumber}</Link> : "—"}
                  </TableCell>
                  <TableCell>{new Date(inv.dueDate).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell className="text-right">{formatGBP(Number(inv.amount))}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{paymentStatusLabels[inv.status as keyof typeof paymentStatusLabels] ?? inv.status}</Badge>
                  </TableCell>
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
        )
      )}
    </div>
  );
}
