import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { listCustomersForJobPicker, listTechnicians } from "@/services/job.service";
import { JobForm } from "../job-form";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const [customers, technicians] = await Promise.all([listCustomersForJobPicker(), listTechnicians()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">New job</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <JobForm customers={customers} technicians={technicians} />
    </div>
  );
}
