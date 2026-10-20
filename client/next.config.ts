import type { NextConfig } from "next";

const stressServiceUrl = (
  process.env.STRESS_API_INTERNAL_URL ?? "http://localhost:8003"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.*"],
  async rewrites() {
    return [
      {
        source: "/api/stress-detection/:path*",
        destination: `${stressServiceUrl}/api/stress-detection/:path*`,
      },
    ];
  },
};

export default nextConfig;
/* working under update*/