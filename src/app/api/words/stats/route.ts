import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Counts for the learn page menu: how many brand-new (un-reviewed) words and
// how many words are due for review right now.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const now = new Date();
  const [newCount, dueCount] = await Promise.all([
    prisma.userWordbook.count({ where: { userId, status: "NEW" } }),
    prisma.userWordbook.count({
      where: { userId, nextReviewAt: { lte: now }, status: { not: "NEW" } },
    }),
  ]);

  return NextResponse.json({ newCount, dueCount });
}
