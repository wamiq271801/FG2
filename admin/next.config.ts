import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The admin is a SEPARATE Next.js application that happens to live in the
  // same repository as the storefront. basePath makes it serve every route
  // under /admin so the dev gateway (storefront reverse-proxy rewrite — the
  // sandbox's root Caddy only forwards to the storefront port) can pass
  // /admin/* through unchanged.
  basePath: "/admin",
  // Deliberately NO cacheComponents: the admin is a private management tool
  // and renders fresh per request. This is independent of the storefront's
  // cache architecture (Phase 2 boundary — untouched).
  // Server Actions validate the browser Origin against x-forwarded-host.
  // Through the sandbox chain (space-z.ai preview gateway → Caddy :81 →
  // storefront :3000 proxy → admin :3001) the forwarded host is an
  // intermediate infra host that never matches the browser origin, so the
  // dev origins must be explicitly allowed for mutations to pass.
  // Next's allowedOrigins supports subdomain wildcards (csrf-protection).
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:81", "localhost", "*.space-z.ai"],
    },
  },
  allowedDevOrigins: ["http://localhost:81", "http://localhost", "*.space-z.ai"],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Product images are served from the existing R2 CDN; the admin only
    // references URLs, it does not process them.
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
