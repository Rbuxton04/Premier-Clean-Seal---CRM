import Link from "next/link";
import { FileDown } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP } from "@/lib/utils";
import { listInvoices } from "@/services/invoice.service";
import { listCustomers } from "@/services/customer.service";
import { paymentStatuses, paymentStatusLabels } from "@/validators/job";
import type { InvoiceListItem } from "@/services/invoice.service";
import { getCurrentUser } from "@/lib/auth";
import { canViewFinancials, hasRole } from "@/lib/permissions";
import { DeleteInvoiceButton } from "./delete-invoice-button";
import { InvoiceFilters } from "./invoice-filters";
import { invoicePeriodPresets, resolveInvoicePeriod, type InvoicePeriodPreset } from "./invoice-period";

export const dynamic = "force-dynamic";

type InvoicesSearchParams = { period?: string; from?: string; to?: string; customerId?: string; status?: string; q?: string };

async function loadInvoices(searchParams: InvoicesSearchParams) {
  const preset = (invoicePeriodPresets.find((p) => p === searchParams.period) ?? "all") as InvoicePeriodPreset;
  const range = resolveInvoicePeriod(preset, searchParams.from, searchParams.to);
  const status = paymentStatuses.find((s) => s === searchParams.status);
  const customerId = searchParams.customerId || undefined;
  const q = searchParams.q || undefined;

  try {
    const [invoices, customers] = await Promise.all([
      listInvoices({ from: range.from, to: range.to, customerId, status, q }),
      listCustomers(),
    ]);
    return { invoices, customers, dbOnline: true as const };
  } catch {
    return { invoices: [] as InvoiceListItem[], customers: [] as Awaited<ReturnType<typeof listCustomers>>, dbOnline: false as const };
  }
}

export default async function InvoicesPage({ searchParams }: { searchParams: InvoicesSearchParams }) {
  const user = await getCurrentUser();
  if (!canViewFinancials(user?.roles ?? [])) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Invoices</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <Badge variant="warning">Invoices are restricted to Admin and Office roles.</Badge>
      </div>
    );
  }
  const isAdmin = hasRole(user, "ADMIN");
  const { invoices, customers, dbOnline } = await loadInvoices(searchParams);
  const hasFilters = Boolean(
    (searchParams.period && searchParams.period !== "all") || searchParams.customerId || searchParams.status || searchParams.q
  );

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
        <>
          <InvoiceFilters customers={customers.map((c) => ({ id: c.id, name: c.name, company: c.company }))} />
          <p className="text-xs text-muted-foreground">
            Showing {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
            {hasFilters ? " matching your filters" : ""}.
          </p>
        </>
      )}

      {dbOnline && (
        invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "No invoices match your filters." : "No invoices yet — these are raised automatically when a job is completed."}
          </p>
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
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                          <FileDown className="h-3.5 w-3.5" /> PDF
                        </a>
                      </Button>
                      {isAdmin && <DeleteInvoiceButton invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />}
                    </div>
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
