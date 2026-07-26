import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExamType } from "@/lib/enums";

export async function GET() {
  const session = await getServerSession(authOptions);
  const articles = await prisma.article.findMany({
    orderBy: { level: "asc" },
    select: {
      id: true,
      title: true,
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

function normWord(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z'-]/g, "");
}

// Import a graded-reading article submitted by the user.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json()) as {
    title: string;
    level?: string;
    cefr?: number;
    content: string;
    source?: string;
  };

  const title = (b.title ?? "").trim();
  const content = (b.content ?? "").trim();
  if (!title || !content) {
    return NextResponse.json({ error: "标题和正文都不能为空" }, { status: 400 });
  }

  const level = (b.level && VALID_LEVELS.includes(b.level as ExamType) ? b.level : "COMMON") as ExamType;
  const cefr = Math.min(5, Math.max(1, Math.round(Number(b.cefr) || 1)));
  const wordCount = content.match(/[a-zA-Z'-]+/g)?.length ?? 0;

  // Unique normalized words appearing in the text, to link known words.
  const tokens = Array.from(
    new Set((content.match(/[a-zA-Z'-]+/g) ?? []).map(normWord).filter(Boolean))
  );

  const known = tokens.length
    ? await prisma.word.findMany({
        where: { headword: { in: tokens } },
        select: { id: true },
      })
    : [];

  const article = await prisma.article.create({
    data: {
      title,
      level,
      cefr,
      content,
      wordCount,
      source: b.source?.trim() || "用户导入",
    },
  });

  if (known.length) {
    await prisma.articleWord.createMany({
      data: known.map((w) => ({ articleId: article.id, wordId: w.id })),
    });
  }

  return NextResponse.json({ ok: true, articleId: article.id });
}
