"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Article {
  id: string;
  title: string;
  level: string;
  cefr: number;
  wordCount: number;
  source?: string | null;
  progress: { finished: boolean; progress: number }[] | false;
}

const LEVEL_LABEL: Record<string, string> = {
  CET4: "四级", CET6: "六级", KY: "考研", COMMON: "通用",
  TEM4: "专四", TEM8: "专八", IELTS: "雅思", TOEFL: "托福",
};

const LEVELS = Object.keys(LEVEL_LABEL);

interface ImportForm {
  title: string;
  level: string;
  cefr: number;
  content: string;
}

export default function ReadingPage() {
  const { status } = useSession();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<ImportForm>({ title: "", level: "COMMON", cefr: 1, content: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const d = await fetch("/api/articles").then((r) => r.json());
    setArticles(d.articles ?? []);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function importArticle(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: "导入成功！" });
        setForm({ title: "", level: "COMMON", cefr: 1, content: "" });
        setShowImport(false);
        await load();
      } else {
        setMsg({ ok: false, text: data.error ?? "导入失败，请重试" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="mt-10 text-center text-slate-400">加载中…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">分级阅读</h1>
        <button onClick={() => setShowImport((s) => !s)} className="btn-primary">
          {showImport ? "收起" : "＋ 导入阅读"}
        </button>
      </div>

      {showImport && (
        <form onSubmit={importArticle} className="card mb-6 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-500">标题（必填）</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="如 The Little Prince"
              className="input w-full"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-500">难度</label>
              <select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                className="input w-full"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-500">CEFR（1~5）</label>
              <select
                value={form.cefr}
                onChange={(e) => setForm((f) => ({ ...f, cefr: Number(e.target.value) }))}
                className="input w-full"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-500">正文（必填）</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="粘贴或输入英文阅读文本…"
              rows={8}
              className="input w-full font-mono text-sm"
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "导入中…" : "导入阅读文本"}
            </button>
            {msg && (
              <span className={msg.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{msg.text}</span>
            )}
          </div>
        </form>
      )}

      {articles.length === 0 && (
        <div className="card mt-4 text-center text-slate-500">
          暂无阅读材料，请先运行词库与文章种子脚本（<code>prisma/seed</code>），或点击右上角「＋ 导入阅读」。
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {articles.map((a) => {
          const p = a.progress ? a.progress[0] : undefined;
          return (
            <Link key={a.id} href={`/reading/${a.id}`} className="card hover:border-brand-300 hover:shadow">
              <div className="flex items-center justify-between">
                <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                  {LEVEL_LABEL[a.level] ?? a.level} · CEFR {a.cefr}
                </span>
                {p?.finished && <span className="text-xs text-emerald-600">已读完</span>}
              </div>
              <h3 className="mt-2 font-semibold text-slate-800">{a.title}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {a.wordCount} 词 {a.source ? `· ${a.source}` : ""}
                {p && !p.finished && p.progress > 0 && ` · 已读 ${Math.round(p.progress * 100)}%`}
              </p>
            </Link>
          );
        })}
      </div>
      {status !== "authenticated" && (
        <p className="mt-4 text-center text-sm text-slate-400">
          <Link href="/login" className="text-brand-600">登录</Link> 后阅读时点击生词可一键加入生词本。
        </p>
      )}
    </div>
  );
}
