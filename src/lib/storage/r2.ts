/**
 * Cloudflare R2 upload seam. Until R2_* env vars are set (see .env.example
 * and the README), isR2Configured() is false and callers should fall back
 * to keeping files client-side only — nothing here is called yet.
 *
 * When R2 is wired up: presignUpload() will mint a short-lived presigned PUT
 * URL so the browser uploads directly to R2 (never proxying large files
 * through the Render dyno), and return the public URL to store on MediaFile.
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

export type PresignRequest = { filename: string; contentType: string };
export type PresignResult = { uploadUrl: string; publicUrl: string };

export async function presignUpload(_req: PresignRequest): Promise<PresignResult> {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  }
  // TODO(R2): once credentials exist, add @aws-sdk/client-s3 +
  // @aws-sdk/s3-request-presigner and generate a presigned PUT URL here.
  throw new Error("R2 adapter not yet implemented.");
}

/**
 * Server-side upload seam (e.g. persisting a generated quote PDF). Unlike
 * presignUpload — which lets the browser upload directly — this runs on the
 * server, since the PDF is generated there. Callers should check
 * isR2Configured() first and treat a throw here as non-fatal (fall back to
 * on-demand generation) rather than blocking the calling flow.
 */
export async function uploadBuffer(_key: string, _buffer: Buffer, _contentType: string): Promise<string> {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  }
  // TODO(R2): once credentials exist, add @aws-sdk/client-s3's PutObjectCommand
  // here and return the resulting public URL.
  throw new Error("R2 adapter not yet implemented.");
}
