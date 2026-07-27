import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/auth/callback",
        destination: "/auth-callback.html",
      },
    ];
  },
};

export default nextConfig;
