import { NextResponse } from "next/server";
import { isSupabaseStorageConfigured, presignUpload } from "@/lib/storage/supabase";

// Public (unauthenticated) — used by both the anonymous quote-request form
// and the (Clerk-protected) job completion wizard, so it must degrade
// gracefully rather than 401/500 when Supabase Storage isn't wired up yet.
// Once the SUPABASE_* storage env vars are set, isSupabaseStorageConfigured()
// flips true and this starts returning real signed upload URLs; until then
// it tells the client "not configured yet" so it falls back to keeping the
// file selected client-side only.
//
// Since anyone can call this without signing in, `folder` is restricted to
// an allowlist rather than trusting whatever the client sends — otherwise a
// caller could mint signed upload URLs into prefixes like "backups/" that
// were never meant to accept public writes.
const ALLOWED_FOLDERS = new Set(["uploads", "jobs"]);

export async function POST(req: Request) {
  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ configured: false });
  }

  let body: { filename?: string; contentType?: string; folder?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  if (!body.filename || !body.contentType) {
    return NextResponse.json({ ok: false, message: "filename and contentType are required." }, { status: 400 });
  }

  const folder = body.folder && ALLOWED_FOLDERS.has(body.folder) ? body.folder : "uploads";

  try {
    const result = await presignUpload({ filename: body.filename, contentType: body.contentType, folder });
    return NextResponse.json({ configured: true, ...result });
  } catch (err) {
    console.error("Presign failed", err);
    return NextResponse.json({ ok: false, message: "Upload service unavailable." }, { status: 500 });
  }
}
