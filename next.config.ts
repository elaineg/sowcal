import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo checkout has a parent lockfile; pin the root so local builds
  // don't warn (irrelevant on Vercel where the app dir is the project root).
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
