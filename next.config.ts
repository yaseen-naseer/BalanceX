import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Allow dev-mode access from other devices on the local network
  allowedDevOrigins: ["172.18.3.138"],

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
        ],
      },
    ];
  },
};

export default nextConfig;
