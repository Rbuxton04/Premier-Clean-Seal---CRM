import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage — the app's sole file storage backend, now that the
 * database has also moved to Supabase. presignUpload() for browser uploads,
 * uploadFile() for server-side uploads (generated PDFs), getFileUrl() for
 * reading.
 *
 * The bucket is private — see getFileUrl(). Until NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY / SUPABASE_STORAGE_BUCKET are set,
 * isSupabaseStorageConfigured() is false and every function below is either
 * skipped by its caller or fails soft (see each function).
 */
export function isSupabaseStorageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET);
}

let client: SupabaseClient | null = null;

/** Service-role client — full read/write access, SERVER-SIDE ONLY. Never import this module from a "use client" file. */
function getClient(): SupabaseClient {
  if (!isSupabaseStorageConfigured()) {
    throw new Error("Supabase Storage is not configured — set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET.");
  }
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

function bucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET!;
}

// Long enough that a signed URL embedded in a server-rendered page (gallery,
// documents list, AI photo analysis) stays valid for a normal viewing
// session without needing to be refreshed mid-page.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type PresignRequest = { filename: string; contentType: string; folder?: string };
export type PresignResult = { uploadUrl: string; path: string };

/**
 * Mints a signed upload URL so the browser can upload directly to the
 * private bucket without ever seeing the service role key — the client PUTs
 * its file body straight to uploadUrl, same as the old R2 presigned PUT.
 * `path` is what callers should store (on MediaFile.url, etc.) — a stable
 * reference to resolve back to a viewable link later via getFileUrl().
 */
export async function presignUpload(req: PresignRequest): Promise<PresignResult> {
  const folder = (req.folder ?? "uploads").replace(/[^a-zA-Z0-9/_-]/g, "_");
  const path = `${folder}/${Date.now()}-${req.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { data, error } = await getClient().storage.from(bucket()).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Could not create a signed upload URL.");
  return { uploadUrl: data.signedUrl, path: data.path };
}

/** Server-side upload (a generated PDF, a backup archive). Returns the storage path — callers needing a viewable link should call getFileUrl(). */
export async function uploadFile(path: string, body: Buffer, contentType: string): Promise<string> {
  const { error } = await getClient().storage.from(bucket()).upload(path, body, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

/**
 * Signed, time-limited URL for viewing/downloading a private object. Never
 * throws — returns null if storage isn't configured or the signed-URL
 * request fails, so a gallery/document page can render around one missing
 * file rather than crash. Callers should fall back to the raw path (a
 * harmlessly broken link, not a crash) when this returns null.
 */
export async function getFileUrl(path: string): Promise<string | null> {
  if (!path || !isSupabaseStorageConfigured()) return null;
  try {
    const { data, error } = await getClient().storage.from(bucket()).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Lists object keys directly under a folder path (non-recursive — matches how it's actually used: a flat "backups/" folder). Used by the backup retention sweep. */
export async function listObjectKeys(prefix: string): Promise<string[]> {
  const folder = prefix.replace(/\/$/, "");
  const { data, error } = await getClient().storage.from(bucket()).list(folder, { limit: 1000 });
  if (error || !data) return [];
  return data.filter((obj) => obj.id).map((obj) => `${folder}/${obj.name}`);
}

export async function deleteObject(path: string): Promise<void> {
  const { error } = await getClient().storage.from(bucket()).remove([path]);
  if (error) throw error;
}

/** Downloads an object's body as a Buffer — used by the restore drill / verification tooling. */
export async function downloadObject(path: string): Promise<Buffer> {
  const { data, error } = await getClient().storage.from(bucket()).download(path);
  if (error || !data) throw error ?? new Error("Download failed.");
  return Buffer.from(await data.arrayBuffer());
}
