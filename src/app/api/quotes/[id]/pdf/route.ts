import { NextResponse } from "next/server";
import { getQuote, getQuotePdfBuffer } from "@/services/quote.service";

// Staff-facing download — protected by the default (non-public) middleware.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const quote = await getQuote(params.id);
  if (!quote) return NextResponse.json({ message: "Quote not found" }, { status: 404 });

  const buffer = await getQuotePdfBuffer(quote);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
    },
  });
}
