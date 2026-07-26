import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lookup a word's stored definition by headword (lowercased).
export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word")?.trim().toLowerCase();
  if (!word) return NextResponse.json({ word: null });

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
  return NextResponse.json({ word: w });
}
