import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExamType } from "@/lib/enums";

const VALID_LEVELS: ExamType[] = [
  "COMMON", "CET4", "CET6", "KY", "TEM4", "TEM8", "IELTS", "TOEFL",
];

function normWord(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z'-]/g, "");
}

// List the current user's imported word libraries (with word counts).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const libraries = await prisma.wordLibrary.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      desc: true,
      level: true,
      createdAt: true,
      _count: { select: { words: true } },
    },
  });
  return NextResponse.json({ libraries });
}

// Import a word library from pasted text or an uploaded file's text content.
// Accepted line format: `word` or `word | 中文释义` (also supports `,` or tab).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json()) as {
    title: string;
    level?: string;
    desc?: string;
    content: string;
  };

  const title = (b.title ?? "").trim();
  const raw = (b.content ?? "").trim();
  if (!title || !raw) {
    return NextResponse.json({ error: "词库名称和单词清单都不能为空" }, { status: 400 });
  }

  const level = (b.level && VALID_LEVELS.includes(b.level as ExamType) ? b.level : "COMMON") as ExamType;

  const seen = new Set<string>();
  const wordIds: string[] = [];

  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line) continue;

    const m = line.match(/^(\S+)\s*[\|，,\t]\s*(.*)$/);
    const headRaw = m ? m[1] : line;
    const def = m && m[2] ? m[2].trim() : null;
    const head = normWord(headRaw);
    if (!head || seen.has(head)) continue;

    const word = await prisma.word.upsert({
      where: { headword: head },
      create: { headword: head, definitionCn: def },
      update: def ? { definitionCn: def } : {},
    });
    seen.add(head);
    wordIds.push(word.id);
  }

  if (wordIds.length === 0) {
    return NextResponse.json({ error: "未能解析出任何有效单词" }, { status: 400 });
  }

  const library = await prisma.wordLibrary.create({
    data: {
      userId: session.user.id,
      title,
      desc: b.desc?.trim() || null,
      level,
      words: {
        create: wordIds.map((wordId, i) => ({ wordId, order: i })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, libraryId: library.id, count: wordIds.length });
}
