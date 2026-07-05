import { NextResponse } from "next/server";
import { getQuoteByToken, getQuotePdfBuffer } from "@/services/quote.service";

// Public — authorises by the unguessable approval token only, no auth.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const quote = await getQuoteByToken(params.token);
  if (!quote) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const buffer = await getQuotePdfBuffer(quote);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quoteNumber}.pdf"`,
    },
  });
}
