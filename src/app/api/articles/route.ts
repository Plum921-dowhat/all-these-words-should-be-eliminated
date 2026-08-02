import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExamType } from "@/lib/enums";
import {
  tryParseJson,
  extractArticleList,
  asExamType,
} from "@/lib/importJson";
import { lemmatize } from "@/lib/lemmatize";

export async function GET() {
  const session = await getServerSession(authOptions);
  const articles = await prisma.article.findMany({
    orderBy: { level: "asc" },
    select: {
      id: true,
      title: true,
      dek: true,
      level: true,
      cefr: true,
      wordCount: true,
      source: true,
      progress: session?.user?.id
        ? { where: { userId: session.user.id }, select: { finished: true, progress: true } }
        : false,
    },
  });
  return NextResponse.json({ articles });
}

const VALID_LEVELS: ExamType[] = [
  "COMMON", "CET4", "CET6", "KY", "TEM4", "TEM8", "IELTS", "TOEFL",
];

// 清洗抓取/粘贴来的文章正文，使其适配「按空行分段」的存储格式：
//   - 折叠多余空白行，避免噪音段
//   - 将单个换行（网页正文常见的软换行 / 导航列表相连的短行）合并为空格，
//     仅当行本身是较短的「导航/列表噪音」才保留为独立段落的判断交由下游分段处理
//   - 去除明显的导航噪音行（如连续的 `·`、`|` 分隔、纯大写菜单项）
export function cleanArticle(raw: string): string {
  if (!raw) return "";
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) {
      out.push(""); // 保留空行作为分段信号
      continue;
    }
    // 跳过明显导航噪音：短且含多个分隔符，或纯大写短菜单
    if (/^[A-Z0-9 /|·•—-]{1,30}$/.test(line) && /[|·•—]/.test(line)) continue;
    out.push(line);
  }
  let text = out.join("\n");
  // 折叠连续空行为单个空行（即单个 \n\n 分段）
  text = text.replace(/\n{3,}/g, "\n\n");
  // 单换行连接相邻非空行（视为同一段落内的软换行）
  text = text.replace(/([^\n])\n([^\n])/g, "$1 $2");
  return text.trim();
}

// 保守地从标题中剥离导语（dek / standfirst）：
//   - 仅当 title 含换行，或单行长度 > MAX_TITLE_LEN 且含句末标点时才尝试拆分
//   - 正常短标题绝不误伤，返回 null
// 返回 { title, dek }，dek 总长截断到 MAX_DEK_LEN。
const MAX_TITLE_LEN = 80;
const MAX_DEK_LEN = 160;

export function extractDek(rawTitle: string): { title: string; dek: string | null } {
  if (!rawTitle) return { title: "", dek: null };

  // 情形 1：含换行 → 多行粘贴（如「标题\n导语」或「标题\n副标题\n导语」）
  if (rawTitle.includes("\n")) {
    const lines = rawTitle.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      // 取最短的非空行作为标题（标题通常比导语句短），其余累计为 dek
      const title = lines.reduce((a, b) => (a.length <= b.length ? a : b));
      const rest = lines.filter((l) => l !== title).join(" ");
      const dek = rest.length > MAX_DEK_LEN ? rest.slice(0, MAX_DEK_LEN).trim() : rest;
      return { title, dek: dek || null };
    }
    return { title: rawTitle.trim(), dek: null };
  }

  // 情形 2：单行但超长且含句末分隔 → 在最后一个句末切断
  if (rawTitle.length > MAX_TITLE_LEN) {
    const cut = rawTitle.search(/[.!?。！？:：]\s/);
    if (cut > 0 && cut < rawTitle.length - 1) {
      const title = rawTitle.slice(0, cut + 1).trim();
      let dek = rawTitle.slice(cut + 1).trim();
      if (dek.length > MAX_DEK_LEN) dek = dek.slice(0, MAX_DEK_LEN).trim();
      return { title, dek: dek || null };
    }
  }

  return { title: rawTitle, dek: null };
}

// Turn an article object (or legacy fields) into { title, level, cefr, content, source }.
// Per-article fields take precedence; the supplied fallback (form fields) is only
// used when the article itself does not provide a value.
function buildArticleInput(raw: any, fallback: {
  title: string;
  level: ExamType;
  cefr: number;
  content: string;
  source: string;
}) {
  const obj = raw && typeof raw === "object" ? raw : null;

  let title =
    (obj?.title ?? obj?.name ?? obj?.heading ?? fallback.title)?.toString().trim() || "";

  let bodySource: string | null = null;
  if (obj) {
    if (typeof obj.content === "string") bodySource = obj.content;
    else if (typeof obj.body === "string") bodySource = obj.body;
    else if (typeof obj.text === "string") bodySource = obj.text;
    else if (Array.isArray(obj.content)) bodySource = obj.content.join("\n\n");
    else if (Array.isArray(obj.paragraphs)) bodySource = obj.paragraphs.join("\n\n");
    else if (Array.isArray(obj.body)) bodySource = obj.body.join("\n\n");
  }
  const content = ((bodySource ?? fallback.content) || "").trim();

  const level = asExamType(
    obj?.level ?? (fallback.level !== "COMMON" ? fallback.level : undefined),
    "COMMON"
  );
  const cefr = Math.min(
    5,
    Math.max(1, Math.round(Number(obj?.cefr ?? obj?.level_num ?? fallback.cefr) || 1))
  );
  const source =
    ((obj?.source?.toString().trim() ?? fallback.source) || "") || "用户导入";

  // dek 优先级：对象自带 dek（方案 B 解析脚本产出）> 从标题自动剥离
  let dek: string | null = null;
  if (obj?.dek != null) {
    const d = String(obj.dek).trim();
    dek = d ? (d.length > MAX_DEK_LEN ? d.slice(0, MAX_DEK_LEN).trim() : d) : null;
  }
  if (!dek) {
    dek = extractDek(title).dek;
    // 若剥离出了 dek，需要把 title 还原成剔除 dek 后的版本
    const stripped = extractDek(title).title;
    if (dek) title = stripped;
  }

  return { title, dek, level, cefr, content: cleanArticle(content), source };
}

// Import one or more graded-reading articles submitted by the user.
// `content` may be a plain-text body or a JSON object / array of articles.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json()) as {
    title?: string;
    level?: string;
    cefr?: number;
    content?: string;
    source?: string;
  };

  const rawContent = (b.content ?? "").trim();
  if (!rawContent) {
    return NextResponse.json({ error: "标题和正文都不能为空" }, { status: 400 });
  }

  const json = tryParseJson(rawContent);
  let articles: ReturnType<typeof buildArticleInput>[] = [];
  if (json) {
    const list = extractArticleList(json);
    if (list && list.length) {
      for (const item of list) {
        const input = buildArticleInput(item, {
          title: (b.title ?? "").trim(),
          level: asExamType(
            b.level && VALID_LEVELS.includes(b.level as ExamType) ? b.level : undefined,
            "COMMON"
          ),
          cefr: Math.min(5, Math.max(1, Math.round(Number(b.cefr) || 1))),
          content: "",
          source: (b.source ?? "").trim() || "用户导入",
        });
        if (input.title && input.content) articles.push(input);
      }
    }
  }

  if (articles.length === 0) {
    // Legacy plain-text single article.
    const input = buildArticleInput(null, {
      title: (b.title ?? "").trim(),
      level: asExamType(
        b.level && VALID_LEVELS.includes(b.level as ExamType) ? b.level : undefined,
        "COMMON"
      ),
      cefr: Math.min(5, Math.max(1, Math.round(Number(b.cefr) || 1))),
      content: rawContent,
      source: (b.source ?? "").trim() || "用户导入",
    });
    if (!input.title || !input.content) {
      return NextResponse.json({ error: "标题和正文都不能为空" }, { status: 400 });
    }
    articles.push(input);
  }

  const createdIds: string[] = [];
  for (const a of articles) {
    const wordCount = a.content.match(/[a-zA-Z'-]+/g)?.length ?? 0;
    const tokens = Array.from(
      new Set((a.content.match(/[a-zA-Z'-]+/g) ?? []).map(lemmatize).filter(Boolean))
    );
    const known = tokens.length
      ? await prisma.word.findMany({ where: { headword: { in: tokens } }, select: { id: true } })
      : [];

    const article = await prisma.article.create({
      data: {
        title: a.title,
        dek: a.dek,
        level: a.level,
        cefr: a.cefr,
        content: a.content,
        wordCount,
        source: a.source,
      },
    });
    createdIds.push(article.id);

    if (known.length) {
      await prisma.articleWord.createMany({
        data: known.map((w: { id: string }) => ({ articleId: article.id, wordId: w.id })),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    count: createdIds.length,
    articleId: createdIds[0] ?? null,
  });
}
