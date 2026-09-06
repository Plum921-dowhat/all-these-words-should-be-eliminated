# syntax=docker/dockerfile:1
# Evil Words — Next.js 16 多阶段构建
#
# 构建：docker compose build
# 运行：docker compose up -d
#
# 三阶段：
#   deps    安装全部依赖（含 devDeps，postinstall 会执行 prisma generate）
#   builder 生产构建（next build 产出 standalone 自包含产物）
#   runner  仅保留运行所需文件 + Prisma 引擎/CLI（容器启动时自动 db push 建表）

########################### 依赖安装 ###########################
FROM node:24-alpine AS deps
WORKDIR /app

# 国内网络加速（npm 官方源与 binaries.prisma.sh 直连易卡住/挂起）：
# - npm_config_registry：npm 依赖走 npmmirror 镜像
# - PRISMA_ENGINES_MIRROR：prisma generate 从 npmmirror 拉取原生引擎
# - dns-result-order=ipv4first：规避 DNS 只返回 AAAA、无 IPv6 路由导致的连接挂起
ENV npm_config_registry=https://registry.npmmirror.com
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# postinstall（prisma generate）会校验 DATABASE_URL 存在但不连接数据库，
# 这里用与 compose 一致的占位值，仅保证变量存在。
ENV DATABASE_URL="postgresql://evilwords:evilwords@postgres:5432/evilwords?schema=public"

# 先复制清单与 prisma schema，最大化利用构建缓存
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

########################### 生产构建 ###########################
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# 启用 standalone 输出（见 next.config.mjs 的环境变量门控）
ENV NEXT_OUTPUT_STANDALONE=1
# 与 deps 阶段一致：构建时再次 prisma generate，同样走国内镜像
ENV npm_config_registry=https://registry.npmmirror.com
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 应用内页面均为动态渲染（force-dynamic），构建期不连接数据库；
# 但 Prisma 与 NextAuth 要求这些变量存在。
ARG DATABASE_URL="postgresql://evilwords:evilwords@postgres:5432/evilwords?schema=public"
ENV DATABASE_URL=$DATABASE_URL
ARG NEXTAUTH_SECRET="build-time-placeholder"
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
# NEXT_PUBLIC_* 变量在构建期内联进客户端 bundle，运行时再设置不生效
ARG NEXT_PUBLIC_APP_NAME="Evil Words"
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# 复用 package.json 的 build 脚本（prisma generate + next build，堆上限 2GB）
RUN npm run build

########################### 运行镜像 ###########################
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# 监听所有网卡，便于容器内外部访问
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# libc6-compat：Next standalone 服务器在 Alpine 下的 glibc 兼容层；
# openssl：Prisma 原生 query engine 依赖 libssl.so.3
RUN apk add --no-cache libc6-compat openssl

# standalone 自包含产物（含 server.js 与生产依赖）
COPY --from=builder /app/.next/standalone ./
# 静态资源（standalone 产物中不含 .next/static）
COPY --from=builder /app/.next/static ./.next/static
# 公开静态文件
COPY --from=builder /app/public ./public
# 完整 node_modules 覆盖：确保 Prisma query engine（.prisma/client）与
# prisma CLI（容器启动时执行 db push 建表）均可用
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# 启动前先同步 schema 到 PostgreSQL（幂等，无变化时 no-op），
# 再启动 standalone 服务器
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
