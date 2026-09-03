import Link from "next/link";
import { Plus, Building2, CalendarClock, ChevronRight } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { listGroupSummaries, type GroupSummary } from "@/services/hotel-group.service";
import { SegmentedProgressBar } from "./segmented-bar";

export const dynamic = "force-dynamic";

async function loadGroups(): Promise<{ groups: GroupSummary[]; dbOnline: boolean }> {
  try {
    return { groups: await listGroupSummaries(), dbOnline: true };
  } catch {
    return { groups: [], dbOnline: false };
  }
}

export default async function PropertiesPage() {
  const { groups, dbOnline } = await loadGroups();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Properties</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/properties/due"><CalendarClock className="h-4 w-4" /> Reseal due</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/properties/groups/new"><Plus className="h-4 w-4" /> New group</Link>
          </Button>
          <Button asChild>
            <Link href="/properties/new"><Plus className="h-4 w-4" /> New property</Link>
          </Button>
        </div>
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate deploy &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hotel groups or properties tracked yet. Start with <Link href="/properties/new" className="text-primary hover:underline">a new property</Link>.
        </p>
      )}

      {dbOnline && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link key={g.id ?? "independent"} href={`/properties/groups/${g.id ?? "independent"}`}>
              <Card className="flex h-full flex-col gap-3 p-5 transition-colors hover:border-brand-plum">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-brand-plum" />
                    <h2 className="font-semibold leading-tight">{g.name}</h2>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>

                <p className="text-xs text-muted-foreground">
                  {g.propertyCount} propert{g.propertyCount === 1 ? "y" : "ies"} · {g.summary.totalRooms} bathroom{g.summary.totalRooms === 1 ? "" : "s"} tracked
                </p>

                <div className="mt-auto space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{formatGBP(g.summary.valueCompletedGbp)} done</span>
                    <span className="text-xs text-muted-foreground">{g.summary.percentComplete}%</span>
                  </div>
                  <SegmentedProgressBar counts={g.summary.counts} />
                  {g.summary.needsAttention > 0 && (
                    <Badge variant="warning" className="text-[10px]">{g.summary.needsAttention} need attention</Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
