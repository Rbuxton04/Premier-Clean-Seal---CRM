import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { listAuditLogs, listAuditResources } from "@/services/audit.service";
import { listUsers } from "@/services/user.service";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: { userId?: string; resource?: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Audit log</h1>
        <Badge variant="warning">This page is restricted to administrators.</Badge>
      </div>
    );
  }

  let logs: Awaited<ReturnType<typeof listAuditLogs>>;
  let resources: Awaited<ReturnType<typeof listAuditResources>>;
  let staff: Awaited<ReturnType<typeof listUsers>>;
  try {
    [logs, resources, staff] = await Promise.all([
      listAuditLogs({ userId: searchParams.userId || undefined, resource: searchParams.resource || undefined }),
      listAuditResources(),
      listUsers(),
    ]);
  } catch {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Audit log</h1>
        <Badge variant="warning">Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Audit log</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Who did what, read-only. Showing the most recent {logs.length} matching events.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="userId">Staff member</label>
          <Select id="userId" name="userId" defaultValue={searchParams.userId ?? ""} className="w-48">
            <option value="">All</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="resource">Resource</label>
          <Select id="resource" name="resource" defaultValue={searchParams.resource ?? ""} className="w-48">
            <option value="">All</option>
            {resources.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
        <Button type="submit" size="sm" variant="outline">Filter</Button>
        {(searchParams.userId || searchParams.resource) && (
          <Button asChild size="sm" variant="ghost"><Link href="/settings/audit">Clear</Link></Button>
        )}
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching audit events.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString("en-GB")}
                </TableCell>
                <TableCell>{l.user?.name ?? <span className="text-muted-foreground">System</span>}</TableCell>
                <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                <TableCell className="text-sm">
                  {l.resource}
                  {l.resourceId && <span className="text-muted-foreground"> ({l.resourceId.slice(0, 10)})</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.ip ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
