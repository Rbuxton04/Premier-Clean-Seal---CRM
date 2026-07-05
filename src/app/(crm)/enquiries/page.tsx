import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { listEnquiries, type EnquiryCardItem } from "@/services/enquiry.service";
import { EnquiryBoard } from "./enquiry-board";

export const dynamic = "force-dynamic";

async function loadEnquiries(): Promise<{ enquiries: EnquiryCardItem[]; dbOnline: boolean }> {
  try {
    const enquiries = await listEnquiries();
    return { enquiries, dbOnline: true };
  } catch {
    return { enquiries: [], dbOnline: false };
  }
}

export default async function EnquiriesPage() {
  const { enquiries, dbOnline } = await loadEnquiries();

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Enquiries</h1>
          <Link href="/request-quote" target="_blank" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            View public form <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        enquiries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No enquiries yet. Share the <Link href="/request-quote" className="text-primary underline">public quote form</Link> to start filling this board.
          </p>
        ) : (
          <EnquiryBoard initialEnquiries={enquiries} />
        )
      )}
    </div>
  );
}
