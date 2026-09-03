import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 Cache Components: 'use cache' + cacheLife replace the legacy
  // `export const revalidate` route segment configs. Every route renders a
  // static shell; uncached/runtime data streams in at request time.
  cacheComponents: true,
  // The single Phase 2 cache profile. There is NO time-based server
  // revalidation anywhere: every 'use cache' scope lives until it is
  // explicitly dropped by revalidateTag (admin domain event →
  // POST /api/revalidate). `stale: 300` only bounds how long a client may
  // reuse its router cache before re-checking with the server; the server
  // entry itself never revalidates or expires by time.
  cacheLife: {
    indefinite: {
      stale: 300,
      revalidate: Infinity,
      expire: Infinity,
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.fusiongadgets.in",
      },
    ],
  },
};

export default nextConfig;
