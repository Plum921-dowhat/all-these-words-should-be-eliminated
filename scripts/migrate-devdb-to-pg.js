/**
 * 一次性数据迁移：SQLite (prisma/dev.db) → PostgreSQL (Docker)
 * 只读打开旧库，按外键依赖序写入 PG，保留原 UUID，类型归一化（epoch日期/0-1布尔/空串→null）。
 * 幂等：开头清空 PG 全部业务表，可重复执行。
 */
const Database = require("better-sqlite3");
const path = require("path");
const { PrismaClient } = require("../node_modules/.prisma/client-new");

const src = new Database(path.join(__dirname, "..", "prisma", "dev.db"), { readonly: true });
const prisma = new PrismaClient();

const rows = (t) => src.prepare(`SELECT * FROM "${t}"`).all();

const str = (v) => (v == null || v === "" ? null : String(v));
const rstr = (v) => String(v);
const int = (v) => (v == null ? 0 : Number(v));
const num = (v) => (v == null ? 0 : Number(v));
const bool = (v) => !!v;
const date = (v) => (v == null || v === "" ? null : new Date(v));
const rdate = (v) => date(v) ?? new Date(0);

const BATCH = 500;
async function bulk(model, data) {
  let n = 0;
  for (let i = 0; i < data.length; i += BATCH) {
    const r = await prisma[model].createMany({ data: data.slice(i, i + BATCH) });
    n += r.count;
  }
  return n;
}

// 清空顺序：逆外键依赖
const CLEAR = [
  "userStats",
  "userArticleWord",
  "userArticleProgress",
  "articleWord",
  "reviewLog",
  "userWordbook",
  "wordLibraryWord",
  "wordLibrary",
  "wordbookWord",
  "wordExam",
  "article",
  "wordbook",
  "word",
  "user",
];

async function main() {
  console.log("== Step 1: clear PG ==");
  for (const m of CLEAR) console.log(`  clear ${m}:`, (await prisma[m].deleteMany()).count);

  console.log("== Step 2: migrate ==");

  // User
  const users = rows("User");
  for (const r of users) {
    await prisma.user.create({
      data: {
        id: rstr(r.id), email: rstr(r.email), name: str(r.name),
        passwordHash: rstr(r.passwordHash), targetExam: rstr(r.targetExam),
        createdAt: rdate(r.createdAt), updatedAt: rdate(r.updatedAt),
      },
    });
  }
  console.log(`  User: ${users.length}`);

  // Word
  const words = rows("Word");
  console.log(`  Word: ${await bulk("word", words.map((r) => ({
    id: rstr(r.id), headword: rstr(r.headword),
    phoneticUk: str(r.phoneticUk), phoneticUs: str(r.phoneticUs),
    audioUkUrl: str(r.audioUkUrl), audioUsUrl: str(r.audioUsUrl),
    pos: str(r.pos), definitionCn: str(r.definitionCn), definitionEn: str(r.definitionEn),
    examples: str(r.examples), difficulty: int(r.difficulty), freq: int(r.freq),
  })))}`);

  // WordExam
  console.log(`  WordExam: ${await bulk("wordExam", rows("WordExam").map((r) => ({
    wordId: rstr(r.word_id), examType: rstr(r.exam_type),
  })))}`);

  // Wordbook
  const wbs = rows("Wordbook");
  for (const r of wbs) {
    await prisma.wordbook.create({
      data: {
        id: rstr(r.id), title: rstr(r.title), examType: rstr(r.exam_type),
        level: int(r.level), desc: str(r.desc), isSystem: bool(r.isSystem),
        createdAt: rdate(r.createdAt),
      },
    });
  }
  console.log(`  Wordbook: ${wbs.length}`);

  // WordbookWord
  console.log(`  WordbookWord: ${await bulk("wordbookWord", rows("WordbookWord").map((r) => ({
    wordbookId: rstr(r.wordbook_id), wordId: rstr(r.word_id), order: int(r.order),
  })))}`);

  // WordLibrary
  const libs = rows("WordLibrary");
  for (const r of libs) {
    await prisma.wordLibrary.create({
      data: {
        id: rstr(r.id), userId: rstr(r.user_id), title: rstr(r.title),
        desc: str(r.desc), level: rstr(r.level), createdAt: rdate(r.createdAt),
      },
    });
  }
  console.log(`  WordLibrary: ${libs.length}`);

  // WordLibraryWord
  console.log(`  WordLibraryWord: ${await bulk("wordLibraryWord", rows("WordLibraryWord").map((r) => ({
    libraryId: rstr(r.library_id), wordId: rstr(r.word_id), order: int(r.order),
  })))}`);

  // UserWordbook
  const uwb = rows("UserWordbook");
  for (const r of uwb) {
    await prisma.userWordbook.create({
      data: {
        id: rstr(r.id), userId: rstr(r.user_id), wordId: rstr(r.word_id),
        status: rstr(r.status), familiarity: int(r.familiarity), repetitions: int(r.repetitions),
        easeFactor: num(r.easeFactor), intervalDays: int(r.intervalDays),
        nextReviewAt: rdate(r.next_review_at), lastReviewedAt: date(r.last_reviewed_at),
        lastGrade: str(r.last_grade), createdAt: rdate(r.createdAt),
      },
    });
  }
  console.log(`  UserWordbook: ${uwb.length}`);

  // ReviewLog
  console.log(`  ReviewLog: ${await bulk("reviewLog", rows("ReviewLog").map((r) => ({
    id: rstr(r.id), userId: rstr(r.user_id), wordId: rstr(r.word_id),
    result: rstr(r.result), durationMs: int(r.durationMs), createdAt: rdate(r.createdAt),
  })))}`);

  // Article
  const arts = rows("Article");
  for (const r of arts) {
    await prisma.article.create({
      data: {
        id: rstr(r.id), title: rstr(r.title), dek: str(r.dek),
        level: rstr(r.level), cefr: int(r.cefr), content: rstr(r.content),
        source: str(r.source), wordCount: int(r.wordCount), createdAt: rdate(r.createdAt),
      },
    });
  }
  console.log(`  Article: ${arts.length}`);

  // ArticleWord
  console.log(`  ArticleWord: ${await bulk("articleWord", rows("ArticleWord").map((r) => ({
    articleId: rstr(r.article_id), wordId: rstr(r.word_id), freq: int(r.freq),
  })))}`);

  // UserArticleProgress
  const uap = rows("UserArticleProgress");
  for (const r of uap) {
    await prisma.userArticleProgress.create({
      data: {
        id: rstr(r.id), userId: rstr(r.user_id), articleId: rstr(r.article_id),
        progress: num(r.progress), finished: bool(r.finished), lastReadAt: rdate(r.last_read_at),
      },
    });
  }
  console.log(`  UserArticleProgress: ${uap.length}`);

  // UserArticleWord
  const uaw = rows("UserArticleWord");
  for (const r of uaw) {
    await prisma.userArticleWord.create({
      data: {
        id: rstr(r.id), userId: rstr(r.user_id), articleId: rstr(r.article_id),
        wordId: rstr(r.word_id), createdAt: rdate(r.createdAt),
      },
    });
  }
  console.log(`  UserArticleWord: ${uaw.length}`);

  // UserStats
  const us = rows("UserStats");
  for (const r of us) {
    await prisma.userStats.create({
      data: {
        userId: rstr(r.user_id), totalLearned: int(r.totalLearned), mastered: int(r.mastered),
        todayReviewed: int(r.todayReviewed), streakDays: int(r.streakDays),
      },
    });
  }
  console.log(`  UserStats: ${us.length}`);

  console.log("\n== Migration complete ==");
}

main()
  .catch((e) => { console.error("MIGRATION FAILED:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
