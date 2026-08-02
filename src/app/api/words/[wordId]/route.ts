import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Remove a word from the current user's wordbook (does NOT delete the global Word).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ wordId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { wordId } = await params;
  if (!wordId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await prisma.userWordbook.deleteMany({
    where: { userId: session.user.id, wordId },
  });

  return NextResponse.json({ ok: true });
}
