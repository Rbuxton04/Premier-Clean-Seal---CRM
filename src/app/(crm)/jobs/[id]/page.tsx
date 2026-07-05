import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wrench } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { getJob, listTechnicians } from "@/services/job.service";
import { jobStatusLabels, jobStatusBadgeVariant, paymentStatusLabels } from "@/validators/job";
import { JobFieldsForm } from "./job-fields-form";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) notFound();
  const technicians = await listTechnicians();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to jobs
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{job.jobNumber}</h1>
          <Badge variant={jobStatusBadgeVariant[job.status as keyof typeof jobStatusBadgeVariant] ?? "outline"}>
            {jobStatusLabels[job.status as keyof typeof jobStatusLabels] ?? job.status}
          </Badge>
        </div>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Job details</CardTitle></CardHeader>
            <CardContent>
              <JobFieldsForm
                jobId={job.id}
                status={job.status}
                technicianId={job.technicianId}
                scheduledStart={job.scheduledStart}
                scheduledEnd={job.scheduledEnd}
                price={job.price}
                depositPaid={job.depositPaid}
                notes={job.notes}
                internalNotes={job.internalNotes}
                technicians={technicians}
              />
            </CardContent>
          </Card>

          <Card className="border-dashed opacity-80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4 text-brand-plum" /> Completion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Materials used, metres installed, before/after photos, customer signature, satisfaction rating, and
                warranty + invoice generation arrive in Milestone 6.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <Link href={`/customers/${job.customer.id}`} className="font-medium text-primary hover:underline">
                {job.customer.name}
              </Link>
              {job.customer.phone && <p className="text-sm text-muted-foreground">{job.customer.phone}</p>}
              {job.customer.email && <p className="text-sm text-muted-foreground">{job.customer.email}</p>}
              {job.property && <p className="text-sm text-muted-foreground">{job.property.addressLine1}, {job.property.postcode}</p>}
            </CardContent>
          </Card>

          {job.quote && (
            <Card>
              <CardHeader><CardTitle className="text-base">Quote</CardTitle></CardHeader>
              <CardContent>
                <Link href={`/quotes/${job.quote.id}`} className="font-medium text-primary hover:underline">
                  {job.quote.quoteNumber}
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>{formatGBP(Number(job.price))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Deposit paid</span><span>{formatGBP(Number(job.depositPaid))}</span></div>
              <div className="flex justify-between font-medium"><span>Balance due</span><span>{formatGBP(Number(job.balanceDue))}</span></div>
              <Badge variant="outline" className="mt-1">
                {paymentStatusLabels[job.paymentStatus as keyof typeof paymentStatusLabels] ?? job.paymentStatus}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
