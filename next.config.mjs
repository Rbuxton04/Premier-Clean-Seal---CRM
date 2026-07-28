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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // geolocation=(self) — the map/route planner's "Plan my day" uses
          // the browser Geolocation API for the technician's live-location
          // origin. geolocation=() blocked it outright (surfaced as a
          // Permissions-Policy violation in the console) with the map still
          // rendering separately below, but was left restrictive here too
          // since nothing else in the app currently needs geolocation.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none';" },
        ],
      },
    ];
  },
};
export default nextConfig;
