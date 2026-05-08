import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Allow dev-mode access from other devices on the local network (ignored in production).
  // Configure per-machine via DEV_ORIGINS env var, e.g. DEV_ORIGINS="172.18.3.138,192.168.1.10"
  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? (process.env.DEV_ORIGINS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],

  // Security: Configure body size limits for API routes
  experimental: {
    // Limit request body size to 1MB (default for JSON APIs)
    // File uploads (screenshots) have their own 10MB limit in the route handler
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },

  // Security headers (fallback for routes not handled by middleware)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
