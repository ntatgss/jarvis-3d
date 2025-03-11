import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: this will disable the problematic ESLint rules project-wide
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
