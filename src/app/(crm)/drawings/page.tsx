import Link from "next/link";
import { Plus, Ruler, ListOrdered } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listTakeoffs, type TakeoffListItem } from "@/services/takeoff.service";
import { getMaterialDefaults } from "@/services/takeoff-material-defaults.service";
import { getCurrentUser } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";
import { MaterialDefaultsSection } from "./material-defaults-section";

export const dynamic = "force-dynamic";

async function loadTakeoffs(): Promise<{ takeoffs: TakeoffListItem[]; dbOnline: boolean }> {
  try {
    return { takeoffs: await listTakeoffs(), dbOnline: true };
  } catch {
    return { takeoffs: [], dbOnline: false };
  }
}

export default async function DrawingsPage() {
  const { takeoffs, dbOnline } = await loadTakeoffs();
  const user = await getCurrentUser();
  const canManageMaterials = hasAnyRole(user, ["ADMIN", "OFFICE"]);
  const materialDefaults = dbOnline ? await getMaterialDefaults() : { jointWidthMm: 15, jointDepthMm: 10, tubeMl: 310, wastePercent: 10 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Drawings</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Measure linear metres directly off a floor-plan PDF, price it by item, and turn it straight into a quote.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/drawings/rate-card"><ListOrdered className="h-4 w-4" /> Rate card</Link>
          </Button>
          <Button asChild>
            <Link href="/drawings/new"><Plus className="h-4 w-4" /> New drawing</Link>
          </Button>
        </div>
      </div>

      <MaterialDefaultsSection defaults={materialDefaults} canManage={canManageMaterials} />

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate deploy &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && takeoffs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No drawings yet. <Link href="/drawings/new" className="text-primary hover:underline">Upload a plan</Link> to measure your first one.
        </p>
      )}

      {dbOnline && takeoffs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {takeoffs.map((t) => (
            <Link key={t.id} href={`/drawings/${t.id}`}>
              <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-brand-plum">
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 shrink-0 text-brand-plum" />
                  <h2 className="font-medium leading-tight">{t.name}</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.scaleRatioLabel ?? "Custom scale"}
                  {t.customer ? ` · ${t.customer.name}` : ""}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  {t.job && <Badge variant="outline" className="text-[10px]">Job {t.job.jobNumber}</Badge>}
                  {t.quote && <Badge variant="outline" className="text-[10px]">Quote {t.quote.quoteNumber}</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
