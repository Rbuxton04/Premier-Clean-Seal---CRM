import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatGBP } from "@/lib/utils";
import { jobStatusLabels, jobStatusBadgeVariant } from "@/validators/job";
import { propertyTypeLabels } from "@/validators/customer";
import { enquiryStageLabels } from "@/validators/enquiry";
import type { SearchResults } from "@/services/search.service";

export function ResultsList({ results }: { results: SearchResults }) {
  if (results.items.length === 0) {
    return <p className="text-sm text-muted-foreground">No results.</p>;
  }

  switch (results.entity) {
    case "jobs":
      return (
        <ul className="space-y-2">
          {results.items.map((j) => (
            <li key={j.id}>
              <Link href={`/jobs/${j.id}`} className="block rounded-lg border p-3 hover:bg-accent/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{j.jobNumber}</span>
                  <Badge variant={jobStatusBadgeVariant[j.status as keyof typeof jobStatusBadgeVariant] ?? "outline"}>
                    {jobStatusLabels[j.status as keyof typeof jobStatusLabels] ?? j.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{j.customer.name}</span>
                  {j.property && <span className="text-xs text-muted-foreground">{j.property.postcode}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {j.technician && <span>{j.technician.name}</span>}
                  {j.materials[0] && (
                    <span>
                      {j.materials[0].product.manufacturer} {j.materials[0].product.name} — {j.materials[0].product.colour}
                    </span>
                  )}
                  <span className="ml-auto font-medium text-foreground">{formatGBP(Number(j.price))}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      );

    case "customers":
      return (
        <ul className="space-y-2">
          {results.items.map((c) => (
            <li key={c.id}>
              <Link href={`/customers/${c.id}`} className="block rounded-lg border p-3 hover:bg-accent/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.company && <span className="text-sm text-muted-foreground">{c.company}</span>}
                  {c.tags.map((t) => (
                    <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: t.colour }}>
                      {t.name}
                    </span>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span>{c.phone}</span>}
                  <span>{c._count.properties} propert{c._count.properties === 1 ? "y" : "ies"}</span>
                  <span>{c._count.jobs} job{c._count.jobs === 1 ? "" : "s"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      );

    case "properties":
      return (
        <ul className="space-y-2">
          {results.items.map((p) => (
            <li key={p.id}>
              <Link href={`/customers/${p.customer.id}`} className="block rounded-lg border p-3 hover:bg-accent/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.addressLine1}</span>
                  <Badge variant="secondary">{propertyTypeLabels[p.propertyType as keyof typeof propertyTypeLabels] ?? p.propertyType}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{p.postcode}</span>
                  <span>{p.customer.name}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      );

    case "enquiries":
      return (
        <ul className="space-y-2">
          {results.items.map((e) => (
            <li key={e.id}>
              <Link href={`/enquiries/${e.id}`} className="block rounded-lg border p-3 hover:bg-accent/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.name}</span>
                  <Badge variant="outline">{enquiryStageLabels[e.stage as keyof typeof enquiryStageLabels] ?? e.stage}</Badge>
                  <span className="text-xs text-muted-foreground">{e.postcode}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{e.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      );
  }
}
