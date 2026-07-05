import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getQuoteByToken, recordQuoteViewed, displayStatus } from "@/services/quote.service";
import { QuotePreview } from "@/app/(crm)/quotes/quote-preview";
import { ApprovalPanel } from "./approval-panel";

export const dynamic = "force-dynamic";

export default async function QuoteApprovalPage({ params }: { params: { token: string } }) {
  await recordQuoteViewed(params.token);
  const quote = await getQuoteByToken(params.token);
  if (!quote) notFound();

  const ds = displayStatus(quote);
  const pdfHref = `/api/public/quotes/${params.token}/pdf`;

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Quote {quote.quoteNumber}</h1>
      <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />

      <div className="mt-6">
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
      </div>

      <a href={pdfHref} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <FileDown className="h-4 w-4" /> Download as PDF
      </a>

      <div className="mt-6">
        <ApprovalPanel token={params.token} status={ds} depositAmount={quote.depositAmount != null ? Number(quote.depositAmount) : null} />
      </div>
    </div>
  );
}
