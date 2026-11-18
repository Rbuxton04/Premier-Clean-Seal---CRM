import { NextResponse } from "next/server";
import { getQuote, getQuoteDocxBuffer } from "@/services/quote.service";

// Staff-facing download — protected by the default (non-public) middleware,
// same as the PDF route it sits alongside.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const quote = await getQuote(params.id);
  if (!quote) return NextResponse.json({ message: "Quote not found" }, { status: 404 });

  const buffer = await getQuoteDocxBuffer(quote);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${quote.quoteNumber}.docx"`,
    },
  });
}
