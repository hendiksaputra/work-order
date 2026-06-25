import type { NextConfig } from "next";

// Laravel API di mesin yang sama; browser memanggil /api (same origin) — hindari CORS & localhost
const apiBackend = process.env.API_BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBackend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
