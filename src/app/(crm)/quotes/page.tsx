import Link from "next/link";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP } from "@/lib/utils";
import { listQuotes, displayStatus } from "@/services/quote.service";
import { quoteStatuses, quoteStatusLabels, quoteStatusBadgeVariant } from "@/validators/quote";
import type { QuoteListItem } from "@/services/quote.service";
import { DeleteQuoteButton } from "./delete-quote-button";
import { getCurrentUser } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function loadQuotes(status?: string): Promise<{ quotes: QuoteListItem[]; dbOnline: boolean }> {
  try {
    return { quotes: await listQuotes(status), dbOnline: true };
  } catch {
    return { quotes: [], dbOnline: false };
  }
}

export default async function QuotesPage({ searchParams }: { searchParams: { status?: string } }) {
  const status = searchParams.status;
  const user = await getCurrentUser();
  const isAdmin = hasRole(user, "ADMIN");
  const { quotes, dbOnline } = await loadQuotes(status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Quotes</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <Button asChild>
          <Link href="/quotes/new">New quote</Link>
        </Button>
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          <div className="flex flex-wrap gap-2">
            <Link href="/quotes" className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-brand-plum text-white" : "border text-muted-foreground hover:bg-accent"}`}>
              All
            </Link>
            {quoteStatuses.map((s) => (
              <Link
                key={s}
                href={`/quotes?status=${s}`}
                className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-brand-plum text-white" : "border text-muted-foreground hover:bg-accent"}`}
              >
                {quoteStatusLabels[s]}
              </Link>
            ))}
          </div>

          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Valid until</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => {
                  const ds = displayStatus(q);
                  return (
                    <TableRow key={q.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/quotes/${q.id}`} className="font-medium text-primary hover:underline">
                          {q.quoteNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {q.customer.name}
                        {q.customer.company && <span className="text-muted-foreground"> ({q.customer.company})</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={quoteStatusBadgeVariant[ds as keyof typeof quoteStatusBadgeVariant] ?? "outline"}>
                          {quoteStatusLabels[ds as keyof typeof quoteStatusLabels] ?? ds}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatGBP(Number(q.total))}</TableCell>
                      <TableCell>{new Date(q.createdAt).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell>{q.expiresAt ? new Date(q.expiresAt).toLocaleDateString("en-GB") : "—"}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <DeleteQuoteButton quoteId={q.id} quoteNumber={q.quoteNumber} />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
