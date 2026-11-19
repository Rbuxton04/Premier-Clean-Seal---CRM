import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { listCustomers } from "@/services/customer.service";
import { listScalePresets } from "@/services/scale-preset.service";
import { isSupabaseStorageConfigured } from "@/lib/storage/supabase";
import { NewTakeoffForm } from "./new-takeoff-form";

export const dynamic = "force-dynamic";

export default async function NewTakeoffPage({
  searchParams,
}: {
  searchParams: { customerId?: string; jobId?: string; quoteId?: string };
}) {
  const [customers, presets] = await Promise.all([listCustomers(), listScalePresets()]);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">New drawing</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <NewTakeoffForm
        customers={customers.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
        presets={presets}
        storageReady={isSupabaseStorageConfigured()}
        defaultCustomerId={searchParams.customerId}
        jobId={searchParams.jobId}
        quoteId={searchParams.quoteId}
      />
    </div>
  );
}
