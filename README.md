# LexiLearn

面向大学生的英语词汇 + 分级阅读学习平台，重点覆盖**四六级（CET-4 / CET-6）**、**考研（KY）**等考试场景。核心能力包括：系统/自建词书背单词、基于 SM-2 遗忘曲线的智能复习（SRS）、阅读文章内置查词与一键加入生词本、以及用户自定义词库与阅读的导入。

---

## 核心功能

- **词书背单词**：内置按考试（四六级、考研等）划分的系统词书，也可导入自建词库。
- **SRS 智能复习**：采用 SM-2 遗忘曲线算法，根据熟悉度、连对次数、难度系数与间隔天数安排下一次复习（评价档位：`AGAIN / HARD / GOOD / EASY`）。
- **分级阅读**：按考试/难度（CEFR 1~5）组织文章，阅读时点击单词即可查本地释义，并可将生词一键加入生词本（自动进入 SRS 队列）。
- **生词本**：统一查看、批量导入（JSON / 纯文本）、复习管理。
- **导入生态**：词库、单词、阅读三类入口均支持 **JSON** 与**纯文本行**两种格式（详见「数据导入」一节）。
- **学习统计**：累计学习量、已掌握数、今日复习数、连续打卡天数等。

---

## 技术栈

| 分类 | 选型 |
|------|------|
| 框架 | Next.js 16.2.12（App Router, Turbopack, React 19, TypeScript 5） |
| 样式 | Tailwind CSS 3 + 自定义工具类（`globals.css` 中的 `card` / `btn` / `btn-primary`） |
| ORM / 数据库 | Prisma 5.18（默认 SQLite，可选 PostgreSQL） |
| 认证 | NextAuth.js 4（Credentials 登录 + 注册，JWT 会话） |
| 密码哈希 | bcryptjs |
| 状态管理 | Zustand、React Query（@tanstack/react-query） |

---

## 环境要求

- Node.js ≥ 18（建议 LTS，Windows 需 Node 18.18+）
- npm（随 Node 自带）
- 本地默认使用 **SQLite**，开箱即用，**无需 Docker / WSL**
- （可选）Docker Desktop，仅在你希望用 PostgreSQL 时才需要
- 在 **Windows** 上：`next dev` 使用 Turbopack，默认不调整堆内存即可正常工作（已通过 `serverExternalPackages` 把 next-auth / prisma / bcryptjs 外部化，避免编译期 OOM）。**不要**在 `dev` 脚本里盲目加大 `NODE_OPTIONS=--max-old-space-size`，否则反而会因为大堆导致 GC 停顿、开发服务器卡顿。

---

## 快速开始（本地，SQLite）

项目默认以文件型 SQLite 数据库运行，零外部依赖。

1. **安装依赖**（会自动触发 `postinstall` 执行 `prisma generate`）：

   ```bash
   npm install
   ```

2. **初始化数据库表结构**（会在 `prisma/dev.db` 生成 SQLite 文件）：

   ```bash
   npm run db:push
   ```

3. **（可选）填充种子数据**：

   ```bash
   npm run db:seed
   ```

4. **启动开发服务器**：

   ```bash
   npm run dev
   ```

   打开浏览器访问 http://localhost:3000 即可。

> 环境变量见 `.env`（已随仓库提供默认值，本地直接可用）：
> - `DATABASE_URL="file:./dev.db"` —— SQLite 文件路径
> - `NEXTAUTH_SECRET` / `NEXTAUTH_URL` —— 认证相关；生产环境务必把 `NEXTAUTH_SECRET` 换成 `openssl rand -base64 32` 生成的随机串
> - `NEXT_PUBLIC_APP_NAME` —— 站点名称（默认 `LexiLearn`）

---

## 使用 Docker 运行 PostgreSQL（可选）

如果你希望使用 PostgreSQL 而非 SQLite（例如更接近生产环境），项目提供了 `docker-compose.yml`：

- 镜像：`postgres:16-alpine`
- 本机端口映射到 **5433**（避免与你已有 PostgreSQL 的 5432 冲突）
- 库名 / 用户 / 密码均为 `lexilearn`

步骤：

```bash
docker compose up -d
```

然后将 `.env` 中的 `DATABASE_URL` 改为：

```
DATABASE_URL="postgresql://lexilearn:lexilearn@localhost:5433/lexilearn"
```

并执行（注意 SQLite 与 PostgreSQL 的字段类型差异，切换后需重新 push）：

```bash
npm run db:push
```

### SQLite vs PostgreSQL 说明

- 本地开发与 MVP 默认 **SQLite**，无需任何容器，最省事。
- `prisma/schema.prisma` 中 `provider = "sqlite"`，枚举（如考试类型、复习档位）以 **STRING** 列存储，允许值在 `src/lib/enums.ts` 中定义。
- 切换到 PostgreSQL 只需修改 `provider` 与 `DATABASE_URL`，但由于两者类型差异（如 SQLite 无原生枚举、布尔、部分类型），建议切换前确认 schema 兼容性并重新 `db push`。

---

## npm 脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动 Next.js 开发服务器（Turbopack，端口 3000）；**不**调整堆内存，保持开发流畅 |
| `npm run build` | 先 `prisma generate`，再以 `NODE_OPTIONS=--max-old-space-size=2048` 运行 `next build`（一次性生产构建，堆上限温和提到 2GB） |
| `npm run start` | 运行生产构建后的服务 |
| `npm run postinstall` | 依赖安装后自动执行 `prisma generate` |
| `npm run db:push` | 将 Prisma schema 同步到数据库（建表） |
| `npm run db:seed` | 执行种子脚本（`prisma/seed/index.ts`，使用 `tsx` 运行） |
| `npm run db:studio` | 打开 Prisma Studio 可视化管理数据库 |

> `next.config.mjs` 中设置了 `serverActions.bodySizeLimit = "2mb"`，用于支持较大的导入请求；并通过 `serverExternalPackages` 把 next-auth / @prisma/client / bcryptjs 外部化，规避 Turbopack 在 Windows 上的编译期 OOM（`HashMap::Initialize`）。

---

## 项目结构

```
.
├── prisma/
│   ├── schema.prisma        # 数据模型（默认 SQLite）
│   ├── seed/                # 种子脚本
│   └── dev.db               # 本地 SQLite 文件（git 已跟踪，可删除重建）
├── src/
│   ├── app/
│   │   ├── api/             # 后端接口（Route Handlers）
│   │   ├── learn/           # 复习/学习页
│   │   ├── login/           # 登录/注册页
│   │   ├── reading/         # 分级阅读页
│   │   ├── word-library/    # 词库详情与管理
│   │   ├── wordbook/        # 我的生词本
│   │   ├── layout.tsx
│   │   ├── page.tsx         # 首页
│   │   └── globals.css
│   ├── components/          # 前端组件（如 ArticleReader 阅读器）
│   └── lib/
│       ├── prisma.ts        # Prisma 客户端（指向自定义 client-new 输出）
│       ├── auth.ts          # NextAuth 配置
│       ├── api/dictionary.ts# 外部词典（当前未接线，见下）
│       └── enums.ts         # 枚举允许值
├── docker-compose.yml       # 可选的 PostgreSQL
├── next.config.mjs
├── package.json
└── .env
```

> Prisma 客户端使用**自定义输出路径**：`schema.prisma` 中 `generator.output = "../node_modules/.prisma/client-new"`，代码统一从该路径导入（`src/lib/prisma.ts`）。修改 schema 后务必重新 `prisma generate`，保持二者一致。

---

## 主要页面与路由

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/login` | 登录 / 注册（邮箱 + 密码，含目标考试选择） |
| `/learn` | 复习/学习（SRS 队列，展示待复习单词） |
| `/reading` | 分级阅读列表 |
| `/word-library/[id]` | 词库详情与管理 |
| `/wordbook` | 我的生词本（含查词、批量导入） |

---

## API 概览

所有接口均为 App Router Route Handlers，位于 `src/app/api`。涉及用户数据的接口依赖登录会话。

### 认证 `api/auth/[...nextauth]`
- 标准的 NextAuth 端点；提供 Credentials 登录与注册（注册时 `mode=register`）。

### 单词 `api/words/`
| 端点 | 方法 | 说明 |
|------|------|------|
| `/lookup?word=xxx` | GET | **查词**：按规范词形（小写 headword）查询本地 `Word` 表，并返回当前用户是否已加入生词本。仅查本地数据库，不发起外部网络请求。 |
| `/add` | POST | 添加单词到当前用户生词本（支持单条 / 数组 / `{ words: [...] }`，状态 `NEW`）。 |
| `/batch` | POST | 批量添加（详见「数据导入」）。 |
| `/due` | GET | 获取当前用户待复习（到期）单词列表。 |
| `/list` | GET | 列出用户生词本。 |
| `/review` | POST | 提交复习结果，更新 SRS 字段（熟悉度、连对、难度系数、间隔、下次复习时间）。 |
| `/mark` | POST | 阅读中标记单词（加入生词本 / SRS 队列）。 |
| `/stats` | GET | 学习统计。 |
| `/[wordId]` | GET / PATCH / DELETE | 单词详情与更新。 |

### 词库 `api/word-library/`
| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | POST | 导入词库（支持 JSON / 纯文本，详见导入文档）。 |
| `/[id]` | GET / PATCH / DELETE | 词库详情与管理。 |

### 阅读 `api/articles/`
| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET / POST | 文章列表 / 导入阅读（支持 JSON 单篇或数组）。 |
| `/progress` | POST | 更新用户阅读进度。 |

---

## 数据导入（JSON 格式）

三个导入入口（导入词库、添加单词、导入阅读）同时支持 **JSON** 与**纯文本行**格式：后端按 `content` 是否以 `{` 或 `[` 开头自动判别。完整字段映射见 [`docs/import-json.md`](./docs/import-json.md)。

要点速览：

- **单词条目**可写为对象 `{ "headword": "apple", "definitionCn": "苹果" }`、二元数组 `["apple", "苹果"]`，或字符串 `"apple | 苹果"`。
- **导入词库**：`POST /api/word-library`，请求体含 `title` / `level` / `desc` / `content`。
- **添加单词**：`POST /api/words/add` 或 `/batch`，写入当前用户生词本。
- **导入阅读**：`POST /api/articles`，每篇正文可为字符串或段落数组。
- 字段名做了宽松映射（`headword`/`word`/`term`…，`definitionCn`/`def`/`meaning`…）。
- 所有导入接口均需登录（依赖会话），未登录返回 401。

---

## 认证说明

- 使用 **NextAuth.js（Credentials 模式）**：邮箱 + 密码登录，密码经 bcrypt 哈希存储。
- 会话策略为 **JWT**，登录态保存在客户端 token 中。
- 注册与登录共用同一 Credentials Provider，通过 `mode` 字段区分（`login` / `register`）；邮箱已存在时注册返回 `EMAIL_TAKEN`。
- 登录页路径：`/login`（`authOptions.pages.signIn`）。

---

## 关于「外部词典查询」

需要特别说明，以免误解：

- **本地查词（真实可用）**：`/api/words/lookup` 接口**只查询本地 `Word` 表**（`prisma.word.findUnique`），并返回该词是否在当前用户生词本中。**它不会向任何外部词典服务发起请求**。当本地库没有该词时，返回结果为空。
- **外部词典代码（当前未接线 / 死代码）**：仓库中存在 `src/lib/api/dictionary.ts`，内含 `enrichWord()`，可实现调用**有道 `dict.youdao.com/jsonapi`** 与 **`dictionaryapi.dev`** 的免费查词（无需 API key）。但经核实，该函数**目前没有任何外部引用 / 调用**，属于未接线的死代码，**不会影响运行时行为**。
- 因此，当前版本的「词典查询」能力 = 本地数据库查词。如果你希望启用外部在线查词（例如本地查不到时回退到有道拉取并写库），需要把 `enrichWord()` 接入 `lookup` 等接口——这属于后续功能增强，不在当前范围内。

---

## 常见问题（FAQ）

**Q：`prisma generate` 之后仍然报 client 找不到？**
A：本项目 Prisma 输出路径为自定义 `node_modules/.prisma/client-new`，请确认 `schema.prisma` 的 `generator.output` 与 `src/lib/prisma.ts` 的导入路径一致，并重新 `npm run db:push` + `prisma generate`。

**Q：打开页面提示数据库相关错误？**
A：确认已执行 `npm run db:push` 生成 `prisma/dev.db`；若切换过数据库类型（SQLite ↔ PostgreSQL），需重新 push。

**Q：查不到某个单词的释义？**
A：当前查词仅基于本地 `Word` 表数据。若词库/种子未包含该词，lookup 会返回空（外部在线词典代码尚未接线，见上节）。可通过「导入词库 / 添加单词」补充数据。

**Q：想用 PostgreSQL 而不是 SQLite？**
A：参考「使用 Docker 运行 PostgreSQL（可选）」一节，修改 `provider` 与 `.env` 的 `DATABASE_URL` 后重新 `db:push`。

**Q：导入支持哪些格式？**
A：JSON 与纯文本行均支持，详见 [`docs/import-json.md`](./docs/import-json.md)。

**Q：Windows 上 `next dev` / `next build` 报 `FATAL ERROR: Out of memory: HashMap::Initialize`？**
A：这是 Next 16 Turbopack 在 Windows + 默认 V8 堆（~2GB）下编译含 `next-auth` 的路由模块图时，堆初始化失败的已知问题（devlog.txt 记录过）。本项目已做两件事缓解，无需你手动改代码：
1. **`next.config.mjs` 通过 `serverExternalPackages` 把 `@prisma/client` / `bcryptjs` 外部化**，让 Turbopack 在运行时用原生 `require` 加载它们，而不是把它们塞进单一编译单元 —— 这是治本手段，不影响 dev 流畅度。（注意：不要外部化 `next-auth`，否则会破坏 Turbopack 对 `"use client"` 组件的 React 实例解析，导致 `Invalid hook call`。）
2. 堆内存只在 `npm run build`（`next build`）时温和提到 `2048` MB；**`dev` 脚本刻意不提堆**，避免大堆引发 GC 停顿、开发服务器卡顿甚至被系统杀进程。

如果你仍遇到 OOM：先确认 `next.config.mjs` 的 `serverExternalPackages` 未被删；必要时可临时把 `build` 的 `--max-old-space-size` 调到 3072；或在排查阶段改用 `next build` 单独验证而非 `dev`。

---

## 开发说明

- 前端：`src/app` 下的 App Router 页面；`src/components` 复用组件（如阅读器 `ArticleReader`）。
- 状态：`Zustand` 管理局部 UI 状态，`React Query` 管理服务端数据缓存。
- 数据库访问统一经 `src/lib/prisma.ts` 导出的单例 `prisma` 客户端。
- 修改 `prisma/schema.prisma` 后，务必运行 `npm run db:push`（改结构）与 `prisma generate`（改客户端）。
- 生产构建前将 `.env` 中的 `NEXTAUTH_SECRET` 替换为真实随机串。
