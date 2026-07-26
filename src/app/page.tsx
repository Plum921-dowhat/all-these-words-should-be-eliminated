import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


export default async function Home() {
  const session = await getServerSession(authOptions);
  const [wordCount, articleCount] = await Promise.all([
    prisma.word.count(),
    prisma.article.count(),
  ]);

  return (
    <div className="space-y-8">
      <section className="card bg-gradient-to-br from-brand-600 to-brand-700 text-white">
        <h1 className="text-3xl font-bold">大学生英语四六级 · 考研 背单词 + 分级阅读</h1>
        <p className="mt-2 max-w-2xl opacity-90">
          基于 SM-2 间隔重复算法的智能复习，配合分级阅读材料——读到生词一键加入生词本，闭环学习。
        </p>
        <div className="mt-5 flex gap-3">
          {session ? (
            <Link href="/reading" className="btn bg-white text-brand-700 hover:bg-slate-100">去分级阅读</Link>
          ) : (
            <Link href="/login" className="btn bg-white text-brand-700 hover:bg-slate-100">免费开始</Link>
          )}
          <Link href="/learn" className="btn border border-white/40 hover:bg-white/10">开始背单词</Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="词库单词" value={wordCount} />
        <Stat label="阅读材料" value={articleCount} />
        <Stat label="考试类型" value={8} />
        <Stat label="复习算法" value="SM-2" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Feature title="智能间隔复习" desc="根据遗忘曲线安排复习，越熟间隔越长。" />
        <Feature title="阅读即背词" desc="分级阅读中长按/点击生词，自动进入复习队列。" />
        <Feature title="多考试覆盖" desc="四六级、考研已上线，专四专八雅思托福已预留。" />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold text-brand-700">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}
