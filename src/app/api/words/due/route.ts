import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExamType } from "@/lib/enums";

// Returns due review items for the current user, auto-enrolling new words
// from the user's target-exam wordbook.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);

  // Auto-enroll NEW words from the system wordbook matching the user's target exam.
  const wordbook = await prisma.wordbook.findFirst({
    where: { examType: (session.user.targetExam as ExamType) ?? "CET4" },
    include: { words: { select: { wordId: true } } },
  });
  if (wordbook?.words.length) {
    const existing = await prisma.userWordbook.findMany({
      where: { userId },
      select: { wordId: true },
    });
    const existingIds = new Set(existing.map((e) => e.wordId));
    const toEnroll = wordbook.words
      .map((w) => w.wordId)
      .filter((id) => !existingIds.has(id));
    if (toEnroll.length) {
      await prisma.userWordbook.createMany({
        data: toEnroll.map((wordId) => ({ userId, wordId })),
      });
    }
  }

  const now = new Date();
  const due = await prisma.userWordbook.findMany({
    where: {
      userId,
      nextReviewAt: { lte: now },
    },
    orderBy: [{ nextReviewAt: "asc" }],
    take: limit,
    include: {
      word: {
        select: {
          id: true,
          headword: true,
          phoneticUk: true,
          phoneticUs: true,
          audioUsUrl: true,
          pos: true,
          definitionCn: true,
          definitionEn: true,
          examples: true,
        },
      },
    },
  });

  return NextResponse.json({ items: due });
}
