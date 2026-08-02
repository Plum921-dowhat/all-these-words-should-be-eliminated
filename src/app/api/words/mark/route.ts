import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lemmatize } from "@/lib/lemmatize";

// Mark a word encountered while reading -> add to wordbook (NEW) + user_article_word.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { word, articleId } = (await req.json()) as { word: string; articleId?: string };
  if (!word) return NextResponse.json({ error: "missing word" }, { status: 400 });

  const headword = lemmatize(word);
  if (!headword) return NextResponse.json({ error: "invalid word" }, { status: 400 });

  const w = await prisma.word.findUnique({ where: { headword }, select: { id: true } });
  if (!w) return NextResponse.json({ error: "not_in_db", word: headword }, { status: 404 });

  await prisma.$transaction([
    prisma.userArticleWord.upsert({
      where: {
        userId_articleId_wordId: { userId: session.user.id, articleId: articleId ?? "", wordId: w.id },
      },
      create: { userId: session.user.id, articleId: articleId ?? "", wordId: w.id },
      update: {},
    }),
    prisma.userWordbook.upsert({
      where: { userId_wordId: { userId: session.user.id, wordId: w.id } },
      create: { userId: session.user.id, wordId: w.id, status: "NEW" },
      update: {},
    }),
  ]);

  return NextResponse.json({ ok: true, wordId: w.id });
}
