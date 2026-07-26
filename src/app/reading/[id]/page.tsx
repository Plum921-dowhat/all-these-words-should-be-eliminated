import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ArticleReader } from "@/components/ArticleReader";

export const dynamic = "force-dynamic";


export default async function ArticlePage({ params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      userWords: { where: { userId: (await getSessionId()) ?? "" }, select: { wordId: true } },
    },
  });
  if (!article) notFound();

  const markedIds = new Set(article.userWords.map((u) => u.wordId));

  return (
    <ArticleReader
      articleId={article.id}
      title={article.title}
      content={article.content}
      markedIds={markedIds}
    />
  );
}

async function getSessionId() {
  const s = await getServerSession(authOptions);
  return s?.user?.id ?? null;
}
