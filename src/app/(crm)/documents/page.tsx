import Link from "next/link";
import { FileDown } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { listDocuments } from "@/services/media.service";
import { listCustomers } from "@/services/customer.service";
import { listJobs } from "@/services/job.service";
import { allDocumentCategoryLabels } from "@/validators/media";
import { isR2Configured } from "@/lib/storage/r2";
import type { DocumentItem } from "@/services/media.service";
import { DocumentFilters } from "./document-filters";
import { DocumentUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

async function loadDocuments(query?: string, category?: string, customerId?: string, jobId?: string) {
  try {
    const [documents, customers, jobs] = await Promise.all([
      listDocuments({ query, category, customerId, jobId }),
      listCustomers(),
      listJobs(),
    ]);
    return { documents, customers, jobs, dbOnline: true };
  } catch {
    return { documents: [] as DocumentItem[], customers: [] as Awaited<ReturnType<typeof listCustomers>>, jobs: [] as Awaited<ReturnType<typeof listJobs>>, dbOnline: false };
  }
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; customerId?: string; jobId?: string };
}) {
  const { documents, customers, jobs, dbOnline } = await loadDocuments(searchParams.q, searchParams.category, searchParams.customerId, searchParams.jobId);
  const r2Ready = isR2Configured();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Documents</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          <DocumentUploadForm
            r2Ready={r2Ready}
            customers={customers.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
            jobs={jobs.map((j) => ({ id: j.id, jobNumber: j.jobNumber, customer: j.customer }))}
          />

          <DocumentFilters />

          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{allDocumentCategoryLabels[d.category] ?? d.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {d.customer ? (
                        <Link href={`/customers/${d.customer.id}`} className="text-primary hover:underline">
                          {d.customer.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {d.job ? (
                        <Link href={`/jobs/${d.job.id}`} className="text-primary hover:underline">
                          {d.job.jobNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{new Date(d.createdAt).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>
                      <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <FileDown className="h-3.5 w-3.5" /> Download
                      </a>
                    </TableCell>
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
