import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FolderOpen, Images, Receipt, ShieldCheck, Wrench } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/lib/utils";
import { getJob, listTechnicians } from "@/services/job.service";
import { jobStatusLabels, jobStatusBadgeVariant, paymentStatusLabels } from "@/validators/job";
import { applicationAreaLabels } from "@/validators/completion";
import { JobFieldsForm } from "./job-fields-form";
import { DeleteJobButton } from "../delete-job-button";
import { getCurrentUser } from "@/lib/auth";
import { canViewFinancials } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) notFound();
  const user = await getCurrentUser();
  // TECHNICIAN can only open jobs assigned to them.
  if (user?.role === "TECHNICIAN" && job.technicianId !== user.id) notFound();
  const showFinancials = canViewFinancials(user?.role ?? "READONLY");
  const technicians = await listTechnicians();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to jobs
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{job.jobNumber}</h1>
            <Badge variant={jobStatusBadgeVariant[job.status as keyof typeof jobStatusBadgeVariant] ?? "outline"}>
              {jobStatusLabels[job.status as keyof typeof jobStatusLabels] ?? job.status}
            </Badge>
          </div>
          {user?.role === "ADMIN" && <DeleteJobButton jobId={job.id} jobNumber={job.jobNumber} redirectTo="/jobs" />}
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
                isExternal={job.isExternal}
                technicians={technicians}
                showFinancials={showFinancials}
              />
            </CardContent>
          </Card>

          {job.status === "COMPLETED" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Completion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Metres installed</p>
                    <p className="font-medium">{job.metresInstalled != null ? `${Number(job.metresInstalled)}m` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Satisfaction</p>
                    <p className="font-medium">
                      {job.satisfactionRating ? "★".repeat(job.satisfactionRating) + "☆".repeat(5 - job.satisfactionRating) : "—"}
                    </p>
                  </div>
                </div>

                {job.completionNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap text-sm">{job.completionNotes}</p>
                  </div>
                )}

                {job.materials.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials used</p>
                    <ul className="space-y-1 text-sm">
                      {job.materials.map((m) => (
                        <li key={m.id} className="flex items-center justify-between rounded border px-2 py-1">
                          <span>
                            {m.product.manufacturer} {m.product.name} — {m.product.colour}
                            {" "}
                            <span className="text-muted-foreground">
                              ({applicationAreaLabels[m.applicationArea as keyof typeof applicationAreaLabels] ?? m.applicationArea})
                            </span>
                          </span>
                          <span className="text-muted-foreground">{Number(m.quantityUsed)} {m.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {job.files.filter((f) => f.kind === "PHOTO").length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photos</p>
                      <Link href={`/gallery/${job.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <Images className="h-3.5 w-3.5" /> View full album
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {job.files.filter((f) => f.kind === "PHOTO").map((f) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-md border">
                          <img src={f.thumbnailUrl ?? f.url} alt={f.category ?? "photo"} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {job.customerSignature && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer signature</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={job.customerSignature} alt="Customer signature" className="h-20 rounded border bg-white p-1" />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {job.warranty && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/jobs/${job.id}/warranty-pdf`} target="_blank" rel="noreferrer">
                        <ShieldCheck className="h-3.5 w-3.5" /> Warranty certificate
                      </a>
                    </Button>
                  )}
                  {job.invoice && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/jobs/${job.id}/invoice-pdf`} target="_blank" rel="noreferrer">
                        <Receipt className="h-3.5 w-3.5" /> Invoice {job.invoice.invoiceNumber}
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : job.status !== "CANCELLED" ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4 text-brand-plum" /> Completion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Once the work is done, run the completion wizard to log materials, photos, the customer&apos;s
                  signature and rating — this automatically raises the warranty certificate, invoice, and schedules
                  the next marketing reminder.
                </p>
                <Button asChild size="sm">
                  <Link href={`/jobs/${job.id}/complete`}>
                    <Wrench className="h-3.5 w-3.5" /> Start completion
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
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

          {showFinancials && (
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
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
            <CardContent>
              <Link href={`/documents?jobId=${job.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <FolderOpen className="h-4 w-4" /> View documents &amp; certificates
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
