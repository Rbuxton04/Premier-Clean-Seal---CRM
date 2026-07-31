/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.r2.cloudflarestorage.com" }],
  },
  experimental: {
    // Next's client-side Router Cache otherwise reuses a dynamic route's
    // previously-fetched RSC payload for up to 30s on soft navigation (back
    // button, <Link>), even though every server-side hit is already fully
    // fresh (Prisma, no fetch cache, and dynamic = "force-dynamic" on the
    // pages that need this). That's what made quote approvals appear stale
    // -- e.g. the CRM quote page still showing "Convert to job" disabled --
    // until a manual hard refresh. Setting this to 0 makes every soft
    // navigation to a dynamic route re-fetch, closing that gap app-wide.
    staleTimes: { dynamic: 0 },
  },
  async headers() {
    // Baseline hardening. No strict script-src nonce here (Next's inline
    // bootstrap scripts would need one wired through the App Router), but
    // clickjacking/MIME-sniffing/referrer leakage are closed off regardless.
    //
    // Framing (X-Frame-Options / CSP frame-ancestors) is split into two
    // non-overlapping rules below rather than one blanket rule, so that
    // /request-quote alone can be embedded on the operator's own WordPress
    // site while every other route -- dashboard, customers, invoices, all
    // staff/private pages -- stays fully unframeable. Multiple
    // Content-Security-Policy headers on one response are combined by the
    // browser as an intersection (most restrictive wins), so the permissive
    // frame-ancestors below only works because it's the ONLY CSP header sent
    // for that one route, not layered on top of the strict one.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // geolocation=(self) — the map/route planner's "Plan my day" uses
          // the browser Geolocation API for the technician's live-location
          // origin. geolocation=() blocked it outright (surfaced as a
          // Permissions-Policy violation in the console) with the map still
          // rendering separately below, but was left restrictive here too
          // since nothing else in the app currently needs geolocation.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
      {
        // Public enquiry form only: embeddable via <iframe> on the
        // operator's own WordPress site, and nowhere else. No
        // X-Frame-Options here -- it only supports DENY/SAMEORIGIN, can't
        // name an allowed external origin, and browsers that honour it
        // would block the WordPress embed outright even with the permissive
        // CSP below.
        source: "/request-quote",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://premiercleanandseal.co.uk https://www.premiercleanandseal.co.uk; object-src 'none';",
          },
        ],
      },
      {
        // Every other route: unframeable, belt (X-Frame-Options) and
        // braces (CSP frame-ancestors 'self') for older browsers that only
        // honour one or the other.
        source: "/:path((?!request-quote$).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none';" },
        ],
      },
    ];
  },
};
export default nextConfig;
