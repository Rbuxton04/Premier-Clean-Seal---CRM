import { NextResponse } from "next/server";
import { getTakeoffForExport } from "@/services/takeoff.service";
import { downloadObject, isSupabaseStorageConfigured } from "@/lib/storage/supabase";

// Same-origin, auth-gated PDF stream for the Drawings/measuring tool viewer
// (fixes the "plan doesn't display" report -- see measure-tool.tsx's PDF-
// load effect comment). Staff-only (default Clerk middleware), org-scoped
// and 404s on a soft-deleted takeoff, same as /api/takeoffs/[id]/export.
//
// Streaming through here instead of fetching Supabase's signed URL directly
// from the browser means: a signed URL can never expire mid-session on a
// page left open, there is no cross-origin fetch for the browser to apply
// CORS/range-request rules to, and a genuinely missing/misconfigured file
// gives a real HTTP error with a message rather than pdf.js trying to GET a
// bare storage path as a relative URL and silently 404ing.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ message: "File storage is not configured." }, { status: 503 });
  }

  const takeoff = await getTakeoffForExport(params.id);
  if (!takeoff) return NextResponse.json({ message: "Drawing not found" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await downloadObject(takeoff.pdfFilePath);
  } catch {
    return NextResponse.json({ message: "Could not read the plan file from storage." }, { status: 502 });
  }

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
