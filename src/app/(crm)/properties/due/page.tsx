import Link from "next/link";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP, cn } from "@/lib/utils";
import { listResealDue } from "@/services/hotel-property.service";

export const dynamic = "force-dynamic";

const INTERVAL_OPTIONS = [36, 48, 60] as const;

export default async function ResealDuePage({ searchParams }: { searchParams: { interval?: string } }) {
  const intervalParam = INTERVAL_OPTIONS.find((n) => String(n) === searchParams.interval);
  const rows = await listResealDue(intervalParam);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/properties" className="text-xs text-muted-foreground hover:underline">← Properties</Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Reseal due</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every property with bathrooms past their reseal interval, oldest first — silicone has a roughly 3-year service life, so a completed hotel is a repeat sale waiting to resurface.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/properties/due"
          className={cn("rounded-full px-3 py-1 text-xs font-medium", !intervalParam ? "bg-brand-plum text-white" : "border text-muted-foreground hover:bg-accent")}
        >
          Each property&rsquo;s own interval
        </Link>
        {INTERVAL_OPTIONS.map((n) => (
          <Link
            key={n}
            href={`/properties/due?interval=${n}`}
            className={cn("rounded-full px-3 py-1 text-xs font-medium", intervalParam === n ? "bg-brand-plum text-white" : "border text-muted-foreground hover:bg-accent")}
          >
            {n} months
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing due — every tracked bathroom is within its reseal interval.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Town</TableHead>
              <TableHead>Oldest completed</TableHead>
              <TableHead className="text-right">Bathrooms due</TableHead>
              <TableHead className="text-right">Est. value</TableHead>
              <TableHead>Site contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.propertyId}>
                <TableCell>
                  <Link href={`/properties/${r.propertyId}`} className="font-medium text-primary hover:underline">{r.propertyName}</Link>
                </TableCell>
                <TableCell>{r.groupName ?? "Independent"}</TableCell>
                <TableCell>{r.town ?? "—"}</TableCell>
                <TableCell>{r.oldestCompletedAt.toLocaleDateString("en-GB")}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="warning">{r.dueRoomCount}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{formatGBP(r.estimatedValueGbp)}</TableCell>
                <TableCell className="text-sm">
                  {r.siteContactName ?? "—"}
                  {r.siteContactPhone && <div className="text-xs text-muted-foreground">{r.siteContactPhone}</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
