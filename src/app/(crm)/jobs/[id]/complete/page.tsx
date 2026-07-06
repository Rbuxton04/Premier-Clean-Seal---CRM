import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getJob } from "@/services/job.service";
import { listProductOptions } from "@/services/property.service";
import { CompletionWizard } from "./completion-wizard";

export const dynamic = "force-dynamic";

export default async function JobCompletePage({ params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) notFound();
  if (job.status === "COMPLETED") redirect(`/jobs/${job.id}`);

  const products = await listProductOptions().catch(() => []);

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-16">
      <div>
        <Link href={`/jobs/${job.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to job
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Complete {job.jobNumber}</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 text-sm text-muted-foreground">{job.customer.name}{job.property ? ` — ${job.property.addressLine1}, ${job.property.postcode}` : ""}</p>
      </div>

      <CompletionWizard
        jobId={job.id}
        scheduledStart={job.scheduledStart}
        products={products}
      />
    </div>
  );
}
