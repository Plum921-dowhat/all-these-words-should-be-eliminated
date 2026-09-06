import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone 自包含产物仅用于 Docker 生产部署（docker-compose.yml 的 web 服务）。
  // "next start" 与 standalone 不兼容（Next 16 会警告），因此用环境变量门控：
  // 仅 Dockerfile 的 builder 阶段设置 NEXT_OUTPUT_STANDALONE=1 时，`next build`
  // 才额外生成 .next/standalone（含 server.js）；本地 dev / build / start 不受影响。
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  // Keep heavy CJS deps (next-auth, bcryptjs, prisma client) out of the
  // Turbopack bundle graph. On Windows, inlining them into a single compile
  // unit can blow the V8 heap during `next dev` (HashMap::Initialize OOM).
  // Externalizing makes Turbopack load them via native require at runtime
  // instead, which fixes the OOM without making dev slower.
  // 注意：生效前提是代码从包名 "@prisma/client" 导入（见 src/lib/prisma.ts）；
  // 深层相对路径导入不会被外部化规则匹配。
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  turbopack: {
    // Pin the workspace root so Turbopack doesn't infer it from a stray
    // lockfile in the user home directory (e.g. C:\Users\ripeplum\package-lock.json).
    root: path.resolve(process.cwd()),
  },
  // Prisma 的原生 query engine 不在默认产物追踪范围内，需显式纳入 standalone
  // 产物，否则 Docker 运行时（node server.js）会报 P1001/PANIC 找不到引擎。
  // （Next 16 起该选项移出 experimental，直接放在顶层。）
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.prisma/client/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
