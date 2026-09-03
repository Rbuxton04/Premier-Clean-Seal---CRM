import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ChevronRight } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { getHotelGroup } from "@/services/hotel-group.service";
import { listPropertiesByGroup, getGroupHeaderStats } from "@/services/hotel-property.service";
import { SegmentedProgressBar } from "../../segmented-bar";

export const dynamic = "force-dynamic";

export default async function HotelGroupPage({ params }: { params: { id: string } }) {
  const isIndependent = params.id === "independent";
  const group = isIndependent ? null : await getHotelGroup(params.id);
  if (!isIndependent && !group) notFound();

  const groupId = isIndependent ? null : params.id;
  const [propertiesByRegion, stats] = await Promise.all([
    listPropertiesByGroup(groupId),
    getGroupHeaderStats(groupId),
  ]);
  const regions = Object.keys(propertiesByRegion);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/properties" className="text-xs text-muted-foreground hover:underline">← All groups</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{isIndependent ? "Independent properties" : group!.name}</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <Button asChild>
          <Link href={`/properties/new${isIndependent ? "" : `?groupId=${params.id}`}`}><Plus className="h-4 w-4" /> Add property</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Properties</p>
          <p className="font-display text-xl font-semibold">{stats.propertyCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Bathrooms tracked</p>
          <p className="font-display text-xl font-semibold">{stats.totalRooms}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Value completed</p>
          <p className="font-display text-xl font-semibold">{formatGBP(stats.valueCompletedGbp)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Value remaining</p>
          <p className="font-display text-xl font-semibold">{formatGBP(stats.valueRemainingGbp)}</p>
        </Card>
      </div>

      {regions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No properties yet.</p>
      ) : (
        <div className="space-y-6">
          {regions.map((region) => (
            <div key={region} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{region}</h2>
              <div className="space-y-2">
                {propertiesByRegion[region].map((p) => (
                  <Link key={p.id} href={`/properties/${p.id}`}>
                    <Card className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:border-brand-plum">
                      <div className="min-w-[140px] flex-1">
                        <p className="font-medium leading-tight">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.town ?? "—"}</p>
                      </div>
                      <p className="w-28 shrink-0 text-xs text-muted-foreground">
                        {p.summary.counts.done} done, {p.summary.totalRooms - p.summary.counts.done} outstanding
                      </p>
                      <div className="w-24 shrink-0 text-right text-sm font-medium">{p.summary.percentComplete}%</div>
                      <SegmentedProgressBar counts={p.summary.counts} className="w-full sm:w-32" />
                      {p.summary.needsAttention > 0 && <Badge variant="warning" className="text-[10px]">{p.summary.needsAttention}</Badge>}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
