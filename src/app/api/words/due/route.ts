import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExamType } from "@/lib/enums";

// Returns review items for the current user.
//   mode=review (default): words whose nextReviewAt is already due (incl. NEW).
//   mode=new:               never-reviewed words (status = "NEW"), ignoring due date.
// Auto-enrolls new words from the user's target-exam wordbook first.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const mode = req.nextUrl.searchParams.get("mode") ?? "review";
  const limit = Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20));

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

  const wordSelect = {
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
  } as const;

  if (mode === "new") {
    const items = await prisma.userWordbook.findMany({
      where: { userId, status: "NEW" },
      orderBy: [{ createdAt: "asc" }],
      take: limit,
      include: { word: wordSelect },
    });
    return NextResponse.json({ items, mode: "new" });
  }

  // review mode: due items that are NOT brand-new (NEW is handled by mode=new)
  const now = new Date();
  const due = await prisma.userWordbook.findMany({
    where: {
      userId,
      nextReviewAt: { lte: now },
      status: { not: "NEW" },
    },
    orderBy: [{ nextReviewAt: "asc" }],
    take: limit,
    include: { word: wordSelect },
  });

  return NextResponse.json({ items: due, mode: "review" });
}
