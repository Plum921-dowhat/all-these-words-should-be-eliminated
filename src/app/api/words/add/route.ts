import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeWordEntry, buildWordData, type WordInput } from "@/lib/importJson";

// Manually add a word to the current user's wordbook (SRS queue).
// Accepts a single word object, an array of word objects, or { words: [...] },
// so it can be used both by the single-entry form and the batch JSON import.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json();

  let entries: WordInput[] = [];
  if (Array.isArray(b)) {
    for (const e of b) {
      const wi = normalizeWordEntry(e);
      if (wi) entries.push(wi);
    }
  } else if (b && typeof b === "object") {
    if (Array.isArray(b.words)) {
      for (const e of b.words) {
        const wi = normalizeWordEntry(e);
        if (wi) entries.push(wi);
      }
    } else if (b.headword || b.word || b.term) {
      const wi = normalizeWordEntry(b);
      if (wi) entries.push(wi);
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "invalid word" }, { status: 400 });
  }

  let added = 0;
  let total = 0;
  let lastWordId: string | null = null;

  for (const wi of entries) {
    const { create, update } = buildWordData(wi);
    const word = await prisma.word.upsert({
      where: { headword: wi.headword },
      create: create as any,
      update: update as any,
    });
    lastWordId = word.id;

    const uw = await prisma.userWordbook.upsert({
      where: { userId_wordId: { userId: session.user.id, wordId: word.id } },
      create: { userId: session.user.id, wordId: word.id, status: "NEW" },
      update: {},
    });
    if (uw.status === "NEW" && uw.familiarity === 0) added++;
    total++;
  }

  const alreadyExisted = total === 1 && added === 0;
  return NextResponse.json({
    ok: true,
    wordId: lastWordId,
    added,
    total,
    alreadyExisted,
  });
}
