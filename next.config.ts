import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Transformers.js, pdf-parse, mammoth running as-is in Node.js
  // rather than letting Next.js try to bundle them for the edge runtime.
  // These are only ever used in API routes (server-side), never in client code.
  serverExternalPackages: ["pdf2json", "mammoth"],

  // Opt into Turbopack (Next.js 16 default) — no custom webpack config needed
  // because pdf-parse/mammoth are excluded above and never reach the client bundle.
  turbopack: {},
};

export default nextConfig;
