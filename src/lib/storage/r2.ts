import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 is S3-compatible, so the AWS SDK v3 S3 client works against
 * it unmodified — just point it at the account's R2 endpoint with "auto" as
 * the region. Until R2_* env vars are set, isR2Configured() is false and
 * callers fall back gracefully (no crash) — see each call site.
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!isR2Configured()) throw new Error("R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

function bucket(): string {
  return process.env.R2_BUCKET!;
}

/** Public URL for an object, assuming the bucket is configured for public read (as R2_PUBLIC_URL_BASE, if set) or served via a custom domain. Falls back to the R2 API host otherwise. */
function publicUrlFor(key: string): string {
  const base = process.env.R2_PUBLIC_URL_BASE;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket()}/${key}`;
}

export type PresignRequest = { filename: string; contentType: string; folder?: string };
export type PresignResult = { uploadUrl: string; publicUrl: string };

/** Mints a short-lived presigned PUT URL so the browser can upload directly to R2. */
export async function presignUpload(req: PresignRequest): Promise<PresignResult> {
  const folder = (req.folder ?? "uploads").replace(/[^a-zA-Z0-9/_-]/g, "_");
  const key = `${folder}/${Date.now()}-${req.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const command = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: req.contentType });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 300 });
  return { uploadUrl, publicUrl: publicUrlFor(key) };
}

/** Server-side upload (e.g. a generated PDF, or a backup archive). Returns the object's public URL. */
export async function uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: buffer, ContentType: contentType }));
  return publicUrlFor(key);
}

/** Lists object keys under a prefix (oldest last isn't guaranteed by R2 — callers should sort). Used by the backup retention sweep. */
export async function listObjectKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: continuationToken })
    );
    for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key);
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Downloads an object's body as a Buffer — used by the restore drill / verification tooling. */
export async function downloadObject(key: string): Promise<Buffer> {
  const res = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const chunks: Uint8Array[] = [];
  // @ts-expect-error - Body is a Node.js Readable stream in the Node runtime
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}
