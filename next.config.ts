import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js/Turbopack from bundling these Node.js-only packages.
  // They are only ever used in API routes (server-side) and must run as-is.
  serverExternalPackages: ["pdf2json", "mammoth"],

  turbopack: {},
};

export default nextConfig;
