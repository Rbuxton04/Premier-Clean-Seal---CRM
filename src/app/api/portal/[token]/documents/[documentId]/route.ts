import { NextResponse } from "next/server";
import { resolvePortalToken } from "@/services/portal.service";
import { getQuote, getQuotePdfBuffer } from "@/services/quote.service";
import { getInvoice, getInvoicePdfBuffer } from "@/services/invoice.service";
import { getWarrantyByJobId, getWarrantyPdfBuffer } from "@/services/warranty.service";

// Public — but every document is re-checked against the token's own
// customerId before anything is rendered, so a portal link can only ever
// download that one customer's own quotes/invoices/warranties. documentId
// matches media.service.ts's listDocuments() id scheme (quote-<id>,
// invoice-<id>, warranty-<jobId>).
function parseDocumentId(documentId: string): { kind: "quote" | "invoice" | "warranty"; id: string } | null {
  const match = documentId.match(/^(quote|invoice|warranty)-(.+)$/);
  if (!match) return null;
  return { kind: match[1] as "quote" | "invoice" | "warranty", id: match[2] };
}

function pdfResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

export async function GET(_req: Request, { params }: { params: { token: string; documentId: string } }) {
  const customer = await resolvePortalToken(params.token);
  if (!customer) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const parsed = parseDocumentId(params.documentId);
  if (!parsed) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (parsed.kind === "quote") {
    const quote = await getQuote(parsed.id);
    if (!quote || quote.customer.id !== customer.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const buffer = await getQuotePdfBuffer(quote);
    return pdfResponse(buffer, `${quote.quoteNumber}.pdf`);
  }

  if (parsed.kind === "invoice") {
    const invoice = await getInvoice(parsed.id);
    if (!invoice || invoice.customer.id !== customer.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const buffer = await getInvoicePdfBuffer(invoice);
    return pdfResponse(buffer, `${invoice.invoiceNumber}.pdf`);
  }

  if (parsed.kind === "warranty") {
    const warranty = await getWarrantyByJobId(parsed.id);
    if (!warranty || warranty.job.customer.id !== customer.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const buffer = await getWarrantyPdfBuffer(warranty);
    return pdfResponse(buffer, `Warranty-${warranty.job.jobNumber}.pdf`);
  }

  return NextResponse.json({ message: "Not found" }, { status: 404 });
}
