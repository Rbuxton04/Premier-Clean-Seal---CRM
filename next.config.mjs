/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.r2.cloudflarestorage.com" }],
  },
  experimental: {
    // The job-completion wizard sends resized photos + a signature as base64
    // data URLs in one server action call — the 1MB default is too small.
    serverActions: { bodySizeLimit: "10mb" },
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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none';" },
        ],
      },
    ];
  },
};
export default nextConfig;
