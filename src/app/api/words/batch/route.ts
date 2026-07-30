import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_BATCH = 500;

// Batch remove words from the current user's wordbook.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, MAX_BATCH)
    : [];
  if (ids.length === 0) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const res = await prisma.userWordbook.deleteMany({
    where: { userId: session.user.id, wordId: { in: ids } },
  });

  return NextResponse.json({ ok: true, deleted: res.count });
}
