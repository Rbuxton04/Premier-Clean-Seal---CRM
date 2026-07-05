import { NextResponse } from "next/server";
import { isR2Configured, presignUpload } from "@/lib/storage/r2";

// Public (unauthenticated) — the quote-request form calls this before R2 is
// wired up, so it must degrade gracefully rather than 401/500. Once R2_* env
// vars are set, isR2Configured() flips true and this starts returning real
// presigned URLs; until then it tells the client "not configured yet" so it
// falls back to keeping the file selected client-side only.
export async function POST(req: Request) {
  if (!isR2Configured()) {
    return NextResponse.json({ configured: false });
  }

  let body: { filename?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  if (!body.filename || !body.contentType) {
    return NextResponse.json({ ok: false, message: "filename and contentType are required." }, { status: 400 });
  }

  try {
    const result = await presignUpload({ filename: body.filename, contentType: body.contentType });
    return NextResponse.json({ configured: true, ...result });
  } catch (err) {
    console.error("Presign failed", err);
    return NextResponse.json({ ok: false, message: "Upload service unavailable." }, { status: 500 });
  }
}
