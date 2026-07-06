import Link from "next/link";
import { FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { allDocumentCategoryLabels } from "@/validators/media";
import type { DocumentItem } from "@/services/media.service";

export function CustomerDocumentsPanel({ customerId, documents }: { customerId: string; documents: DocumentItem[] }) {
  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.job ? `${d.job.jobNumber} · ` : ""}
                  {new Date(d.createdAt).toLocaleDateString("en-GB")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{allDocumentCategoryLabels[d.category] ?? d.category}</Badge>
                <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline" aria-label={`Download ${d.name}`}>
                  <FileDown className="h-4 w-4" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/documents?customerId=${customerId}`} className="inline-block text-xs font-medium text-primary hover:underline">
        View all in Documents →
      </Link>
    </div>
  );
}
