import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { articleId, progress, finished } = (await req.json()) as {
    articleId: string;
    progress: number;
    finished?: boolean;
  };
  if (!articleId) return NextResponse.json({ error: "missing articleId" }, { status: 400 });

  await prisma.userArticleProgress.upsert({
    where: { userId_articleId: { userId: session.user.id, articleId } },
    create: { userId: session.user.id, articleId, progress, finished: finished ?? false },
    update: { progress, finished: finished ?? false, lastReadAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
