import { createHmac, timingSafeEqual } from "crypto";

/**
 * Resend signs webhooks using the Svix scheme (svix-id / svix-timestamp /
 * svix-signature headers, HMAC-SHA256 over "id.timestamp.body"). Verification
 * is skipped gracefully when RESEND_WEBHOOK_SECRET isn't set — matching the
 * rest of the app's "unconfigured provider degrades gracefully" pattern —
 * rather than rejecting every event when the operator hasn't wired the
 * secret in yet.
 */
export function verifyResendSignature(opts: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  secret: string | undefined;
}): boolean {
  if (!opts.secret) return true;
  if (!opts.id || !opts.timestamp || !opts.signature) return false;

  const secretBytes = Buffer.from(opts.secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${opts.id}.${opts.timestamp}.${opts.body}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const candidates = opts.signature
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((v): v is string => Boolean(v));

  return candidates.some((sig) => {
    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

/**
 * Twilio signs webhooks with HMAC-SHA1 over the exact callback URL plus its
 * sorted POST params, keyed by TWILIO_AUTH_TOKEN. Skipped gracefully if the
 * token isn't configured (no live Twilio account would be pointing at this
 * endpoint in that case anyway).
 */
export function verifyTwilioSignature(opts: {
  url: string;
  params: Record<string, string>;
  signature: string | null;
  authToken: string | undefined;
}): boolean {
  if (!opts.authToken) return true;
  if (!opts.signature) return false;

  const sortedKeys = Object.keys(opts.params).sort();
  const data = sortedKeys.reduce((acc, key) => acc + key + opts.params[key], opts.url);
  const expected = createHmac("sha1", opts.authToken).update(data, "utf8").digest("base64");

  try {
    return timingSafeEqual(Buffer.from(opts.signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
