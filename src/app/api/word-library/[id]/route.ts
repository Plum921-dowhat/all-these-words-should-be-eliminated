import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: library detail with its words.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const lib = await prisma.wordLibrary.findUnique({
    where: { id: params.id },
    include: {
      words: {
        orderBy: { order: "asc" },
        include: {
          word: {
            select: {
              id: true,
              headword: true,
              phoneticUk: true,
              phoneticUs: true,
              pos: true,
              definitionCn: true,
              examples: true,
            },
          },
        },
      },
    },
  });

  if (!lib || lib.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    library: { id: lib.id, title: lib.title, desc: lib.desc, level: lib.level, createdAt: lib.createdAt },
    words: lib.words.map((w) => w.word),
  });
}

// POST: add every word in this library to the current user's wordbook (skip existing).
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const lib = await prisma.wordLibrary.findUnique({
    where: { id: params.id },
    include: { words: { select: { wordId: true } } },
  });
  if (!lib || lib.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const existing = await prisma.userWordbook.findMany({
    where: { userId },
    select: { wordId: true },
  });
  const existingIds = new Set(existing.map((e) => e.wordId));
  const toAdd = lib.words.map((w) => w.wordId).filter((id) => !existingIds.has(id));

  if (toAdd.length) {
    await prisma.userWordbook.createMany({
      data: toAdd.map((wordId) => ({ userId, wordId })),
    });
  }

  return NextResponse.json({ ok: true, added: toAdd.length });
}

// DELETE: remove the library. The `WordLibraryWord` join rows are removed by
// the cascade rule, but the underlying `Word` rows and any wordbook study
// records are kept intact.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lib = await prisma.wordLibrary.findUnique({ where: { id: params.id } });
  if (!lib || lib.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.wordLibrary.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
