import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleReview } from "@/lib/srs";
import type { ReviewResult } from "@/lib/enums";

const VALID: ReviewResult[] = ["AGAIN", "HARD", "GOOD", "EASY"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { wordId, result, durationMs } = body as {
    wordId: string;
    result: ReviewResult;
    durationMs?: number;
  };
  if (!wordId || !VALID.includes(result)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const record = await prisma.userWordbook.findUnique({
    where: { userId_wordId: { userId: session.user.id, wordId } },
  });
  if (!record) return NextResponse.json({ error: "not enrolled" }, { status: 404 });

  const out = scheduleReview({
    result,
    repetitions: record.repetitions,
    easeFactor: record.easeFactor,
    intervalDays: record.intervalDays,
  });

  await prisma.$transaction([
    prisma.userWordbook.update({
      where: { userId_wordId: { userId: session.user.id, wordId } },
      data: {
        status: out.status,
        familiarity: Math.min(5, record.familiarity + (result === "EASY" ? 1 : result === "AGAIN" ? -1 : 0)),
        repetitions: out.repetitions,
        easeFactor: out.easeFactor,
        intervalDays: out.intervalDays,
        nextReviewAt: out.nextReviewAt,
        lastReviewedAt: new Date(),
        lastGrade: result,
      },
    }),
    prisma.reviewLog.create({
      data: {
        userId: session.user.id,
        wordId,
        result,
        durationMs: durationMs ?? 0,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, nextReviewAt: out.nextReviewAt, status: out.status });
}
