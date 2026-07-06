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
};
export default nextConfig;
