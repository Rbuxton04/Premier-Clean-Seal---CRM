import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getCurrentUser } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";
import { listRateCardItems } from "@/services/takeoff-rate-card.service";
import { getMaterialDefaults } from "@/services/takeoff-material-defaults.service";
import { RateCardTable } from "./rate-card-table";

export const dynamic = "force-dynamic";

export default async function RateCardPage() {
  const user = await getCurrentUser();
  const canManage = hasAnyRole(user, ["ADMIN", "OFFICE"]);
  const [items, materialDefaults] = await Promise.all([listRateCardItems(), getMaterialDefaults()]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/drawings" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Drawings
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Rate card</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Standard items, rates and worst-case materials overrides, set up once and picked from when adding an item
          to a drawing. Editing or deleting a rate card item here never changes an existing drawing or quote — each
          item on a drawing keeps its own name, colour, price and overrides from the moment it was added.
        </p>
        {!canManage && <p className="mt-1 text-xs text-muted-foreground">View only — ask an admin or office user to make changes.</p>}
      </div>

      <RateCardTable items={items} canManage={canManage} materialDefaults={materialDefaults} />
    </div>
  );
}
