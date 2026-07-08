import Link from "next/link";
import { Plus } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatGBP } from "@/lib/utils";
import { listJobs, listTechnicians } from "@/services/job.service";
import { jobStatuses, jobStatusLabels, jobStatusBadgeVariant, paymentStatusLabels } from "@/validators/job";
import type { JobListItem } from "@/services/job.service";
import { JobFilters } from "./job-filters";
import { DeleteJobButton } from "./delete-job-button";
import { getCurrentUser } from "@/lib/auth";
import { canViewFinancials } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function loadJobs(status?: string, technicianId?: string) {
  try {
    const [jobs, technicians] = await Promise.all([listJobs(status, technicianId), listTechnicians()]);
    return { jobs, technicians, dbOnline: true };
  } catch {
    return { jobs: [] as JobListItem[], technicians: [] as Awaited<ReturnType<typeof listTechnicians>>, dbOnline: false };
  }
}

export default async function JobsPage({ searchParams }: { searchParams: { status?: string; technicianId?: string } }) {
  const { status } = searchParams;
  const user = await getCurrentUser();
  // TECHNICIAN only ever sees their own assigned jobs — the query param is
  // ignored for them rather than trusted from the client.
  const technicianId = user?.role === "TECHNICIAN" ? user.id : searchParams.technicianId;
  const showFinancials = canViewFinancials(user?.role ?? "READONLY");
  const isAdmin = user?.role === "ADMIN";
  const { jobs, technicians, dbOnline } = await loadJobs(status, technicianId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Jobs</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <Button asChild>
          <Link href="/jobs/new"><Plus className="h-4 w-4" /> New job</Link>
        </Button>
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/jobs" className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-brand-plum text-white" : "border text-muted-foreground hover:bg-accent"}`}>
              All
            </Link>
            {jobStatuses.map((s) => (
              <Link
                key={s}
                href={`/jobs?status=${s}`}
                className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-brand-plum text-white" : "border text-muted-foreground hover:bg-accent"}`}
              >
                {jobStatusLabels[s]}
              </Link>
            ))}
            <JobFilters technicians={technicians} />
          </div>

          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Scheduled</TableHead>
                  {showFinancials && <TableHead className="text-right">Price</TableHead>}
                  {showFinancials && <TableHead>Payment</TableHead>}
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>
                      <Link href={`/jobs/${j.id}`} className="font-medium text-primary hover:underline">{j.jobNumber}</Link>
                    </TableCell>
                    <TableCell>{j.customer.name}</TableCell>
                    <TableCell>{j.property?.postcode ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={jobStatusBadgeVariant[j.status as keyof typeof jobStatusBadgeVariant] ?? "outline"}>
                        {jobStatusLabels[j.status as keyof typeof jobStatusLabels] ?? j.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{j.technician?.name ?? "Unassigned"}</TableCell>
                    <TableCell>{j.scheduledStart ? new Date(j.scheduledStart).toLocaleDateString("en-GB") : "—"}</TableCell>
                    {showFinancials && <TableCell className="text-right">{formatGBP(Number(j.price))}</TableCell>}
                    {showFinancials && <TableCell>{paymentStatusLabels[j.paymentStatus as keyof typeof paymentStatusLabels] ?? j.paymentStatus}</TableCell>}
                    {isAdmin && (
                      <TableCell>
                        <DeleteJobButton jobId={j.id} jobNumber={j.jobNumber} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
