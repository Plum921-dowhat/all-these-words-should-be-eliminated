import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lemmatize } from "@/lib/lemmatize";

// Lookup a word's stored definition by headword (lowercased) and whether the
// current user already has it in their wordbook. Falls back to the lemmatized
// form (spreads -> spread) when the exact form is not in the dictionary.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const raw = req.nextUrl.searchParams.get("word")?.trim();
  if (!raw) return NextResponse.json({ word: null, inVocab: false });

  const word = lemmatize(raw);
  if (!word) return NextResponse.json({ word: null, inVocab: false });

  const w = await prisma.word.findUnique({
    where: { headword: word },
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
  });

  let inVocab = false;
  if (session?.user?.id && w) {
    const uw = await prisma.userWordbook.findUnique({
      where: { userId_wordId: { userId: session.user.id, wordId: w.id } },
    });
    inVocab = !!uw;
  }
  return NextResponse.json({ word: w, inVocab });
}
