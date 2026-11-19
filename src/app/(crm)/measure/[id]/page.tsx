import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getTakeoff } from "@/services/takeoff.service";
import { listScalePresets } from "@/services/scale-preset.service";
import { listCustomers } from "@/services/customer.service";
import { listRateCardItems } from "@/services/takeoff-rate-card.service";
import { DeleteTakeoffButton } from "./delete-takeoff-button";
import { MeasureTool } from "./measure-tool";

export const dynamic = "force-dynamic";

export default async function TakeoffPage({ params }: { params: { id: string } }) {
  const takeoff = await getTakeoff(params.id);
  if (!takeoff) notFound();

  const [presets, customers, rateCardItems] = await Promise.all([listScalePresets(), listCustomers(), listRateCardItems()]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/measure" className="text-xs text-muted-foreground hover:underline">← Measure</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{takeoff.name}</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <DeleteTakeoffButton id={takeoff.id} name={takeoff.name} />
      </div>

      <MeasureTool
        takeoff={takeoff}
        presets={presets}
        customers={customers.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
        rateCardItems={rateCardItems}
      />
    </div>
  );
}
