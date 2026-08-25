import { PrismaClient } from "../../node_modules/.prisma/client-new";
import type { ExamType } from "../../src/lib/enums";
import { CET4, CET6, KY, ARTICLES, type SeedWord } from "./data";
import { enrichSeed } from "./enrich";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Merge all exam word lists, de-duplicating by headword.
  const map = new Map<string, SeedWord>();
  for (const w of [...CET4, ...CET6, ...KY]) {
    const key = w.headword.toLowerCase();
    const prev = map.get(key);
    if (prev) {
      map.set(key, {
        ...prev,
        exams: Array.from(new Set([...prev.exams, ...w.exams])),
        definitionCn: prev.definitionCn ?? w.definitionCn,
        phoneticUs: prev.phoneticUs ?? w.phoneticUs,
        pos: prev.pos ?? w.pos,
        examples: prev.examples ?? w.examples,
        difficulty: prev.difficulty ?? w.difficulty,
      });
    } else {
      map.set(key, w);
    }
  }
  let all = Array.from(map.values());

  // 2. Enrich via free dictionary API (best-effort, never blocks the seed).
  try {
    all = await enrichSeed(all);
    console.log(`✓ Enriched ${all.length} words via free API`);
  } catch (e) {
    console.warn("⚠ Enrichment skipped:", (e as Error).message);
  }

  // 3. Upsert words.
  for (const w of all) {
    await prisma.word.upsert({
      where: { headword: w.headword.toLowerCase() },
      create: {
        headword: w.headword.toLowerCase(),
        phoneticUs: w.phoneticUs,
        audioUsUrl: (w as any).audioUsUrl,
        pos: w.pos,
        definitionCn: w.definitionCn,
        examples: w.examples,
        difficulty: w.difficulty ?? 3,
      },
      update: {
        phoneticUs: w.phoneticUs,
        audioUsUrl: (w as any).audioUsUrl,
        pos: w.pos,
        definitionCn: w.definitionCn,
        examples: w.examples,
        difficulty: w.difficulty ?? 3,
      },
    });
  }
  console.log(`✓ Upserted ${all.length} words`);

  // 4. Tag words with exam membership (many-to-many).
  for (const w of all) {
    const word = await prisma.word.findUnique({ where: { headword: w.headword.toLowerCase() }, select: { id: true } });
    if (!word) continue;
    for (const exam of w.exams) {
      await prisma.wordExam.upsert({
        where: { wordId_examType: { wordId: word.id, examType: exam as ExamType } },
        create: { wordId: word.id, examType: exam as ExamType },
        update: {},
      });
    }
  }
  console.log("✓ Tagged words with exam types");

  // 5. Create system wordbooks + link words.
  const bookPlans: { exam: ExamType; title: string; desc: string }[] = [
    { exam: "CET4", title: "四级核心词", desc: "大学英语四级高频核心词汇" },
    { exam: "CET6", title: "六级高频词", desc: "大学英语六级高频核心词汇" },
    { exam: "KY", title: "考研核心词", desc: "考研英语核心词汇" },
  ];
  for (const plan of bookPlans) {
    const book = await prisma.wordbook.upsert({
      where: { title: plan.title },
      create: { title: plan.title, examType: plan.exam, desc: plan.desc, isSystem: true },
      update: { examType: plan.exam, desc: plan.desc },
    });
    const words = all.filter((w) => w.exams.includes(plan.exam));
    let order = 0;
    for (const w of words) {
      const word = await prisma.word.findUnique({ where: { headword: w.headword.toLowerCase() }, select: { id: true } });
      if (!word) continue;
      await prisma.wordbookWord.upsert({
        where: { wordbookId_wordId: { wordbookId: book.id, wordId: word.id } },
        create: { wordbookId: book.id, wordId: word.id, order: order++ },
        update: {},
      });
    }
    console.log(`✓ Wordbook "${plan.title}" (${words.length} words)`);
  }

  // 6. Seed sample articles + link their words.
  for (const a of ARTICLES) {
    const existing = await prisma.article.findFirst({ where: { title: a.title } });
    if (existing) {
      console.log(`• Article "${a.title}" already exists, skipping`);
      continue;
    }
    const created = await prisma.article.create({
      data: {
        title: a.title,
        level: a.level,
        cefr: a.cefr,
        source: a.source,
        wordCount: a.content.split(/\s+/).length,
        content: a.content,
      },
    });
    // link words that appear in the article text
    const tokens = new Set(
      (a.content.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).map((t) => t.replace(/[^a-z'-]/g, ""))
    );
    for (const t of tokens) {
      const word = await prisma.word.findUnique({ where: { headword: t }, select: { id: true } });
      if (word) {
        await prisma.articleWord.upsert({
          where: { articleId_wordId: { articleId: created.id, wordId: word.id } },
          create: { articleId: created.id, wordId: word.id },
          update: {},
        });
      }
    }
    console.log(`✓ Article "${a.title}" created`);
  }

  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
