import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep heavy CJS deps (next-auth, bcryptjs, prisma client) out of the
  // Turbopack bundle graph. On Windows, inlining them into a single compile
  // unit can blow the V8 heap during `next dev` (HashMap::Initialize OOM).
  // Externalizing makes Turbopack load them via native require at runtime
  // instead, which fixes the OOM without making dev slower.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  turbopack: {
    // Pin the workspace root so Turbopack doesn't infer it from a stray
    // lockfile in the user home directory (e.g. C:\Users\ripeplum\package-lock.json).
    root: path.resolve(process.cwd()),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
