import Link from "next/link";
import { Plus, FileDown } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import {
  listCertifications,
  listCertificationCategories,
  type CertificationListItem,
} from "@/services/certification.service";
import { certOwnerTypes, certStatuses, certStatusLabels, certStatusBadgeVariant, type CertStatus } from "@/validators/certification";
import type { CertOwnerType } from "@prisma/client";
import { CertificationFilters } from "./certification-filters";
import { DeleteCertificationButton } from "./delete-certification-button";

export const dynamic = "force-dynamic";

type CertsSearchParams = { category?: string; ownerType?: string; status?: string };

async function loadCertifications(searchParams: CertsSearchParams) {
  const ownerType = certOwnerTypes.find((t) => t === searchParams.ownerType) as CertOwnerType | undefined;
  const status = certStatuses.find((s) => s === searchParams.status) as CertStatus | undefined;

  try {
    const [certifications, categories] = await Promise.all([
      listCertifications({ category: searchParams.category || undefined, ownerType, status }),
      listCertificationCategories(),
    ]);
    return { certifications, categories, dbOnline: true as const };
  } catch {
    return { certifications: [] as CertificationListItem[], categories: [] as string[], dbOnline: false as const };
  }
}

export default async function CertificationsPage({ searchParams }: { searchParams: CertsSearchParams }) {
  const user = await getCurrentUser();
  const isAdmin = hasRole(user, "ADMIN");
  const { certifications, categories, dbOnline } = await loadCertifications(searchParams);
  const hasFilters = Boolean(searchParams.category || searchParams.ownerType || searchParams.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Certifications & records</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        </div>
        <Button asChild>
          <Link href="/certifications/new"><Plus className="h-4 w-4" /> Add certification</Link>
        </Button>
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma db push &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          <CertificationFilters categories={categories} />
          <p className="text-xs text-muted-foreground">
            Showing {certifications.length} certification{certifications.length === 1 ? "" : "s"}
            {hasFilters ? " matching your filters" : ""}.
          </p>

          {certifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFilters ? "No certifications match your filters." : "No certifications recorded yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Belongs to</TableHead>
                  <TableHead>Expiry date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {certifications.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="outline">{c.category}</Badge></TableCell>
                    <TableCell>{c.ownerType === "PERSON" ? c.user?.name ?? "—" : "Business"}</TableCell>
                    <TableCell>{new Date(c.expiryDate).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>
                      <Badge variant={certStatusBadgeVariant[c.status]}>{certStatusLabels[c.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.fileUrl && (
                        <a href={c.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          <FileDown className="h-3.5 w-3.5" /> File
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/certifications/${c.id}/edit`}>Edit</Link>
                        </Button>
                        {isAdmin && <DeleteCertificationButton id={c.id} name={c.name} />}
                      </div>
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
