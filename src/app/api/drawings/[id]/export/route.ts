import { NextResponse } from "next/server";
import { getTakeoffForExport } from "@/services/takeoff.service";
import { getMaterialDefaults } from "@/services/takeoff-material-defaults.service";
import { downloadObject } from "@/lib/storage/supabase";
import { generateMarkupPdf, type ExportFileInput } from "@/lib/pdf/takeoff-markup";

// Staff-facing download -- protected by the default (non-public) Clerk
// middleware, same convention as /api/quotes/[id]/pdf. getTakeoffForExport
// is already org-scoped and excludes soft-deleted rows (returns null, so
// this 404s), matching the brief's "staff-only, org-scoped, 404 on
// soft-deleted" requirement.
//
// Drawings Part 3: moved here from /api/takeoffs/[id]/export (a plain
// rename to match the brief's own path, same as the drawings pages'
// earlier move off /measure in Part 1) and extended to combine every one
// of a drawing's files (Drawings Part 1 Step 4), not just the first.

// The free Render web service has 512MB of RAM; loading source PDFs much
// larger than this into pdf-lib (which builds an in-memory object graph,
// not a streaming parse) risks exhausting it. Fail with a friendly error
// rather than let the process crash on an oversized upload. Checked
// against the COMBINED size of every file on the drawing, not just one.
const MAX_COMBINED_SOURCE_BYTES = 50 * 1024 * 1024;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const takeoff = await getTakeoffForExport(params.id);
  if (!takeoff) return NextResponse.json({ message: "Drawing not found" }, { status: 404 });

  const url = new URL(req.url);
  const showPrices = url.searchParams.get("prices") !== "0";
  const pages = url.searchParams.get("pages") === "all" ? "all" : "measured";
  const notes = url.searchParams.get("notes") === "1";
  const materials = url.searchParams.get("materials") === "1";

  const files: ExportFileInput[] = [];
  let combinedBytes = 0;
  for (const file of takeoff.files) {
    let bytes: Buffer;
    try {
      bytes = await downloadObject(file.rawPath);
    } catch {
      return NextResponse.json({ message: `Could not read the "${file.name}" plan file.` }, { status: 502 });
    }
    combinedBytes += bytes.byteLength;
    if (combinedBytes > MAX_COMBINED_SOURCE_BYTES) {
      return NextResponse.json({ message: "This drawing's plans are too large, combined, to export a marked-up copy of. Try smaller/lower-resolution PDFs." }, { status: 413 });
    }
    files.push({ id: file.id, name: file.name, bytes });
  }

  const materialDefaults = materials ? await getMaterialDefaults() : undefined;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateMarkupPdf(files, takeoff, { showPrices, pages, notes, materials, materialDefaults });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "Could not generate the marked-up drawing." }, { status: 500 });
  }

  const filename = `${takeoff.name.replace(/[^a-zA-Z0-9 _-]/g, "")} - marked up.pdf`;
  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
