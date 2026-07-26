import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns ALL words in the current user's wordbook (not just due ones),
// including their most recent review grade (lastGrade) for statistics/tabs.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const search = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  const items = await prisma.userWordbook.findMany({
    where: {
      userId: session.user.id,
      ...(search ? { word: { headword: { contains: search } } } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
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

  return NextResponse.json({ items });
}
