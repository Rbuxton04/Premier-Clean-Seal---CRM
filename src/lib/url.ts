import { headers } from "next/headers";

function isLocalHost(hostOrUrl: string): boolean {
  return /(^|:\/\/)(localhost|127\.0\.0\.1)/i.test(hostOrUrl);
}

function normalize(raw: string): string {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const scheme = isLocalHost(withScheme) ? withScheme : withScheme.replace(/^http:\/\//i, "https://");
  return scheme.replace(/\/+$/, "");
}

/**
 * Single source of truth for the app's public base URL -- used to build
 * every absolute link the app generates: the quote "Approve online" link,
 * customer-portal links, unsubscribe links, and marketing-token links.
 * (render.yaml's cron jobs read APP_URL directly, the same env var.)
 *
 * Primary source is the APP_URL env var -- set this in Render to the live
 * deployed URL (the onrender.com URL now, or a custom domain later --
 * update this var if one is added). If it's unset, falls back to deriving
 * the origin from the current request's Host header, so links generated
 * from a Server Action/Route Handler are still correct even before APP_URL
 * is configured. Only a context with no request at all (e.g. a standalone
 * script) falls through to localhost.
 *
 * Always returns https:// (except for localhost, which has no TLS) with no
 * trailing slash, so every call site can safely do `${appUrl()}/path`.
 */
export function appUrl(): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) return normalize(envUrl);

  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (isLocalHost(host) ? "http" : "https");
      return normalize(`${proto}://${host}`);
    }
  } catch {
    // headers() throws outside a request scope -- fall through to the
    // localhost default below.
  }

  return "http://localhost:3000";
}
