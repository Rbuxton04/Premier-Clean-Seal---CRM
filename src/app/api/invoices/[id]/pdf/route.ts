import { NextResponse } from "next/server";
import { getInvoice, getInvoicePdfBuffer } from "@/services/invoice.service";

// Staff-facing download — protected by the default (non-public) middleware.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id);
  if (!invoice) return NextResponse.json({ message: "Invoice not found" }, { status: 404 });

  const buffer = await getInvoicePdfBuffer(invoice);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
