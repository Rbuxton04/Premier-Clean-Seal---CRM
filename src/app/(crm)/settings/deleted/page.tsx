import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { listDeletedItems, type DeletedItems } from "@/services/deleted-items.service";
import { RestoreJobButton, RestoreQuoteButton, RestoreInvoiceButton, RestorePropertyButton } from "./restore-buttons";

export const dynamic = "force-dynamic";

async function loadDeletedItems(): Promise<{ items: DeletedItems; dbOnline: boolean }> {
  try {
    return { items: await listDeletedItems(), dbOnline: true };
  } catch {
    return { items: { jobs: [], quotes: [], invoices: [], properties: [] }, dbOnline: false };
  }
}

function formatDeletedAt(d: Date): string {
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function DeletedItemsPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Deleted items</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 text-sm text-muted-foreground">
          Soft-deleted jobs, quotes, invoices, and properties — hidden everywhere else, but recoverable here.
        </p>
      </div>

      {!hasRole(user, "ADMIN") ? (
        <Badge variant="warning">Deleted items are restricted to administrators.</Badge>
      ) : (
        <DeletedItemsContent />
      )}
    </div>
  );
}

async function DeletedItemsContent() {
  const { items, dbOnline } = await loadDeletedItems();

  if (!dbOnline) {
    return (
      <Badge variant="warning">
        Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
      </Badge>
    );
  }

  const isEmpty =
    items.jobs.length === 0 && items.quotes.length === 0 && items.invoices.length === 0 && items.properties.length === 0;
  if (isEmpty) {
    return <p className="text-sm text-muted-foreground">Nothing deleted — deleted jobs, quotes, invoices, and properties will show up here.</p>;
  }

  return (
    <div className="space-y-8">
      {items.jobs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Jobs</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Deleted by</TableHead>
                <TableHead>Deleted at</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.jobNumber}</TableCell>
                  <TableCell>{j.customerName}</TableCell>
                  <TableCell>{j.deletedByName ?? "—"}</TableCell>
                  <TableCell>{formatDeletedAt(j.deletedAt)}</TableCell>
                  <TableCell><RestoreJobButton jobId={j.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {items.quotes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Quotes</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Deleted by</TableHead>
                <TableHead>Deleted at</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.quoteNumber}</TableCell>
                  <TableCell>{q.customerName}</TableCell>
                  <TableCell>{q.deletedByName ?? "—"}</TableCell>
                  <TableCell>{formatDeletedAt(q.deletedAt)}</TableCell>
                  <TableCell><RestoreQuoteButton quoteId={q.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {items.invoices.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Invoices</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Voided by</TableHead>
                <TableHead>Voided at</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.invoices.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.invoiceNumber}</TableCell>
                  <TableCell>{i.customerName}</TableCell>
                  <TableCell>{i.deletedByName ?? "—"}</TableCell>
                  <TableCell>{formatDeletedAt(i.deletedAt)}</TableCell>
                  <TableCell><RestoreInvoiceButton invoiceId={i.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {items.properties.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Properties</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Deleted by</TableHead>
                <TableHead>Deleted at</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.address}</TableCell>
                  <TableCell>
                    <Link href={`/customers/${p.customerId}`} className="text-primary hover:underline">{p.customerName}</Link>
                  </TableCell>
                  <TableCell>{p.deletedByName ?? "—"}</TableCell>
                  <TableCell>{formatDeletedAt(p.deletedAt)}</TableCell>
                  <TableCell><RestorePropertyButton propertyId={p.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
