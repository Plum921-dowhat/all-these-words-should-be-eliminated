import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Manually add a word to the current user's wordbook (SRS queue).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json()) as {
    headword: string;
    phoneticUk?: string;
    phoneticUs?: string;
    definitionCn?: string;
    definitionEn?: string;
    examples?: string;
  };

  const norm = (b.headword ?? "").trim().toLowerCase().replace(/[^a-z'-]/g, "");
  if (!norm) return NextResponse.json({ error: "invalid word" }, { status: 400 });

  // 词库里没有则新建，有则复用（不覆盖已有释义）
  const word = await prisma.word.upsert({
    where: { headword: norm },
    create: {
      headword: norm,
      phoneticUk: b.phoneticUk?.trim() || null,
      phoneticUs: b.phoneticUs?.trim() || null,
      definitionCn: b.definitionCn?.trim() || null,
      definitionEn: b.definitionEn?.trim() || null,
      examples: b.examples?.trim() || null,
    },
    update: {},
  });

  // 加入当前用户生词本（NEW 状态，nextReviewAt 默认为 now，立即可复习）
  const uw = await prisma.userWordbook.upsert({
    where: { userId_wordId: { userId: session.user.id, wordId: word.id } },
    create: { userId: session.user.id, wordId: word.id, status: "NEW" },
    update: {},
  });

  return NextResponse.json({ ok: true, wordId: word.id, alreadyExisted: uw.status !== "NEW" || uw.familiarity > 0 });
}
