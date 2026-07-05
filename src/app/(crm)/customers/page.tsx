import Link from "next/link";
import { Plus } from "lucide-react";
import { listCustomers } from "@/services/customer.service";
import { listTags } from "@/services/tag.service";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { FilterBar } from "./filter-bar";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string; tag?: string | string[] } }) {
  const q = searchParams.q?.trim();
  const tagIds = searchParams.tag ? (Array.isArray(searchParams.tag) ? searchParams.tag : [searchParams.tag]) : [];

  let customers: Awaited<ReturnType<typeof listCustomers>> = [];
  let tags: Awaited<ReturnType<typeof listTags>> = [];
  let dbError = false;
  try {
    [customers, tags] = await Promise.all([listCustomers(q, tagIds), listTags()]);
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Customers</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/settings/tags">Manage tags</Link></Button>
          <Button asChild><Link href="/customers/new"><Plus className="h-4 w-4" /> New customer</Link></Button>
        </div>
      </div>

      {!dbError && <FilterBar tags={tags.map((t: (typeof tags)[number]) => ({ id: t.id, name: t.name, colour: t.colour }))} />}

      {dbError ? (
        <Badge variant="warning">Database not connected.</Badge>
      ) : customers.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {q || tagIds.length ? "No customers match your filters." : "No customers yet. Add your first one to get started."}
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Lifetime spend</TableHead>
                <TableHead>Consent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c: (typeof customers)[number]) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/customers/${c.id}`} className="hover:text-primary">{c.name}</Link>
                    {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t: (typeof c.tags)[number]) => (
                        <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: t.colour }}>{t.name}</span>
                      ))}
                      {c.tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="text-xs">{c.email ?? ""}</div>
                    <div className="text-xs">{c.phone ?? ""}</div>
                  </TableCell>
                  <TableCell>{c._count.properties}</TableCell>
                  <TableCell>{c._count.jobs}</TableCell>
                  <TableCell>{formatGBP(Number(c.totalSpend))}</TableCell>
                  <TableCell className="space-x-1">
                    {c.marketingEmail && <Badge variant="secondary">Email</Badge>}
                    {c.marketingSms && <Badge variant="secondary">SMS</Badge>}
                    {!c.marketingEmail && !c.marketingSms && <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
