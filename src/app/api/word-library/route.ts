import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExamType } from "@/lib/enums";
import {
  normalizeWordEntry,
  buildWordData,
  parseWordLine,
  tryParseJson,
  extractWordList,
  asExamType,
} from "@/lib/importJson";

const VALID_LEVELS: ExamType[] = [
  "COMMON", "CET4", "CET6", "KY", "TEM4", "TEM8", "IELTS", "TOEFL",
];

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
// Accepted line formats: `word`, `word | 中文释义`, or dictionary style
// `word [音标] 词性. 释义` (multi-sense splits into structured `pos`).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json()) as {
    title: string;
    level?: string;
    desc?: string;
    content: string;
  };

  const raw = (b.content ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "词库名称和单词清单都不能为空" }, { status: 400 });
  }

  // Detect JSON input (object with `words`, a bare array of words, ...).
  const json = tryParseJson(raw);
  let wordList: any[] | null = null;
  let jsonObj: Record<string, any> | null = null;
  if (json) {
    const list = extractWordList(json);
    if (list && list.length) {
      wordList = list;
      if (!Array.isArray(json) && typeof json === "object") {
        jsonObj = json as Record<string, any>;
      }
    }
  }

  // Metadata: request body wins, fall back to JSON fields when body is empty.
  const title =
    (b.title ?? "").trim() || (jsonObj?.title ? String(jsonObj.title).trim() : "");
  if (!title) {
    return NextResponse.json({ error: "词库名称不能为空" }, { status: 400 });
  }
  const level = asExamType(
    b.level && VALID_LEVELS.includes(b.level as ExamType) ? b.level : jsonObj?.level,
    "COMMON"
  );
  const desc =
    (b.desc?.trim()) ||
    (jsonObj?.desc ? String(jsonObj.desc).trim() : "") ||
    null;

  const seen = new Set<string>();
  const wordIds: string[] = [];

  if (wordList) {
    // JSON structure: each entry is a string / [word, def] / { ... fields }.
    for (const entry of wordList) {
      const wi = normalizeWordEntry(entry);
      if (!wi || seen.has(wi.headword)) continue;
      const { create, update } = buildWordData(wi);
      const word = await prisma.word.upsert({
        where: { headword: wi.headword },
        create: create as any,
        update: update as any,
      });
      seen.add(wi.headword);
      wordIds.push(word.id);
    }
  } else {
    // Plain-text line format: `word | 释义` or `word [音标] 词性. 释义`.
    for (const lineRaw of raw.split(/\r?\n/)) {
      const input = parseWordLine(lineRaw);
      if (!input || seen.has(input.headword)) continue;
      const { create, update } = buildWordData(input);
      const word = await prisma.word.upsert({
        where: { headword: input.headword },
        create: create as any,
        update: update as any,
      });
      seen.add(input.headword);
      wordIds.push(word.id);
    }
  }

  if (wordIds.length === 0) {
    return NextResponse.json({ error: "未能解析出任何有效单词" }, { status: 400 });
  }

  const library = await prisma.wordLibrary.create({
    data: {
      userId: session.user.id,
      title,
      desc,
      level,
      words: {
        create: wordIds.map((wordId, i) => ({ wordId, order: i })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, libraryId: library.id, count: wordIds.length });
}
