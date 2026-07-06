import { NextResponse } from "next/server";
import { getWarrantyByJobId, getWarrantyPdfBuffer } from "@/services/warranty.service";

// Staff-facing download — protected by the default (non-public) middleware.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const warranty = await getWarrantyByJobId(params.id);
  if (!warranty) return NextResponse.json({ message: "Warranty not found" }, { status: 404 });

  const buffer = await getWarrantyPdfBuffer(warranty);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Warranty-${warranty.job.jobNumber}.pdf"`,
    },
  });
}
