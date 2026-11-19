import { NextResponse } from "next/server";
import { getTakeoffForExport } from "@/services/takeoff.service";
import { downloadObject } from "@/lib/storage/supabase";
import { generateMarkupPdf } from "@/lib/pdf/takeoff-markup";

// Staff-facing download -- protected by the default (non-public) Clerk
// middleware, same convention as /api/quotes/[id]/pdf. getTakeoffForExport
// is already org-scoped and excludes soft-deleted rows (returns null, so
// this 404s), matching the brief's "staff-only, org-scoped, 404 on
// soft-deleted" requirement.

// The free Render web service has 512MB of RAM; loading a source PDF much
// larger than this into pdf-lib (which builds an in-memory object graph,
// not a streaming parse) risks exhausting it. Fail with a friendly error
// rather than let the process crash on an oversized upload.
const MAX_SOURCE_PDF_BYTES = 50 * 1024 * 1024;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const takeoff = await getTakeoffForExport(params.id);
  if (!takeoff) return NextResponse.json({ message: "Takeoff not found" }, { status: 404 });

  const url = new URL(req.url);
  const showPrices = url.searchParams.get("prices") !== "0";
  const pages = url.searchParams.get("pages") === "all" ? "all" : "measured";

  let sourceBytes: Buffer;
  try {
    sourceBytes = await downloadObject(takeoff.pdfFilePath);
  } catch {
    return NextResponse.json({ message: "Could not read the original plan file." }, { status: 502 });
  }
  if (sourceBytes.byteLength > MAX_SOURCE_PDF_BYTES) {
    return NextResponse.json({ message: "This plan is too large to export a marked-up copy of. Try a smaller/lower-resolution PDF." }, { status: 413 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateMarkupPdf(sourceBytes, takeoff, { showPrices, pages });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "Could not generate the marked-up plan." }, { status: 500 });
  }

  const filename = `${takeoff.name.replace(/[^a-zA-Z0-9 _-]/g, "")} (marked up).pdf`;
  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
