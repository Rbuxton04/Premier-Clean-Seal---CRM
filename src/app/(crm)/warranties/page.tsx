import Link from "next/link";
import { FileDown } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { listWarranties } from "@/services/warranty.service";
import type { WarrantyListItem } from "@/services/warranty.service";

export const dynamic = "force-dynamic";

async function loadWarranties(query?: string) {
  try {
    return { warranties: await listWarranties(query), dbOnline: true };
  } catch {
    return { warranties: [] as WarrantyListItem[], dbOnline: false };
  }
}

function isExpired(endDate: Date) {
  return new Date(endDate) < new Date();
}

export default async function WarrantiesPage({ searchParams }: { searchParams: { q?: string } }) {
  const { warranties, dbOnline } = await loadWarranties(searchParams.q);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Warranties</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          <form className="max-w-sm">
            <Input name="q" defaultValue={searchParams.q} placeholder="Search by job number or customer…" />
          </form>

          {warranties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No warranties yet — these are issued automatically when a job is completed.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Cover starts</TableHead>
                  <TableHead>Cover ends</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {warranties.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link href={`/jobs/${w.job.id}`} className="font-medium text-primary hover:underline">{w.job.jobNumber}</Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/customers/${w.job.customer.id}`} className="text-primary hover:underline">{w.job.customer.name}</Link>
                    </TableCell>
                    <TableCell>{new Date(w.startDate).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>{new Date(w.endDate).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>
                      <Badge variant={isExpired(w.endDate) ? "outline" : "success"}>{isExpired(w.endDate) ? "Expired" : "Active"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/jobs/${w.job.id}/warranty-pdf`} target="_blank" rel="noreferrer">
                          <FileDown className="h-3.5 w-3.5" /> Certificate
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
