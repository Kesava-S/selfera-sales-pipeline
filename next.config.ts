import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/leads/:id((?!add|import|detail)[^/]+)',
        destination: '/leads/detail?id=:id',
      },
    ]
  },
};

export default nextConfig;
