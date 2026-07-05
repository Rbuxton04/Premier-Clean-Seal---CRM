import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuote, displayStatus } from "@/services/quote.service";
import { listCustomers } from "@/services/customer.service";
import { listProductOptions } from "@/services/property.service";
import { getOrgSettings } from "@/lib/settings";
import { quoteStatusLabels, quoteStatusBadgeVariant } from "@/validators/quote";
import { QuoteBuilder } from "../quote-builder";
import { QuotePreview } from "../quote-preview";
import { QuoteActions } from "./quote-actions";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const quote = await getQuote(params.id);
  if (!quote) notFound();

  const ds = displayStatus(quote);
  const pdfHref = `/api/quotes/${quote.id}/pdf`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/quotes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to quotes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{quote.quoteNumber}</h1>
          <Badge variant={quoteStatusBadgeVariant[ds as keyof typeof quoteStatusBadgeVariant] ?? "outline"}>
            {quoteStatusLabels[ds as keyof typeof quoteStatusLabels] ?? ds}
          </Badge>
        </div>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        {quote.status === "APPROVED" && quote.approvedName && (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
            Approved by {quote.approvedName} on {quote.approvedAt ? new Date(quote.approvedAt).toLocaleDateString("en-GB") : ""}
          </p>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
        <CardContent>
          <QuoteActions quoteId={quote.id} status={quote.status} pdfHref={pdfHref} existingJobId={quote.job?.id} />
        </CardContent>
      </Card>

      {quote.status === "DRAFT" ? (
        <EditableQuote quoteId={quote.id} />
      ) : (
        <QuotePreview
          quoteNumber={quote.quoteNumber}
          customerName={quote.customer.name}
          customerCompany={quote.customer.company}
          propertyAddress={quote.enquiry ? `${quote.enquiry.addressText}, ${quote.enquiry.postcode}` : undefined}
          scopeOfWorks={quote.scopeOfWorks}
          lineItems={quote.lineItems.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit, unitPrice: Number(i.unitPrice) }))}
          subtotal={Number(quote.subtotal)}
          vatApplied={quote.vatApplied}
          vatRatePercent={Number(quote.vatRatePercent)}
          vatAmount={Number(quote.vatAmount)}
          total={Number(quote.total)}
          depositAmount={quote.depositAmount != null ? Number(quote.depositAmount) : null}
          terms={quote.terms}
          warrantyMonths={quote.warrantyMonths}
          createdAt={quote.createdAt}
          expiresAt={quote.expiresAt}
        />
      )}
    </div>
  );
}

async function EditableQuote({ quoteId }: { quoteId: string }) {
  const quote = await getQuote(quoteId);
  if (!quote) return null;

  const [customers, products, org] = await Promise.all([listCustomers(), listProductOptions(), getOrgSettings()]);

  return (
    <QuoteBuilder
      mode="edit"
      quoteId={quote.id}
      quoteNumber={quote.quoteNumber}
      customers={customers}
      products={products}
      org={{ vatRegistered: org.vatRegistered, vatRatePercent: Number(org.vatRatePercent), defaultWarrantyMonths: org.defaultWarrantyMonths }}
      initial={{
        customerId: quote.customer.id,
        enquiryId: quote.enquiry?.id,
        scopeOfWorks: quote.scopeOfWorks,
        terms: quote.terms ?? "",
        warrantyMonths: quote.warrantyMonths ?? org.defaultWarrantyMonths,
        depositAmount: quote.depositAmount != null ? Number(quote.depositAmount) : undefined,
        lineItems: quote.lineItems.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit, unitPrice: Number(i.unitPrice) })),
      }}
    />
  );
}
