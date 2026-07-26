"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Library {
  id: string;
  title: string;
  desc: string | null;
  level: string;
  createdAt: string;
  _count: { words: number };
}

const LEVEL_LABEL: Record<string, string> = {
  CET4: "四级", CET6: "六级", KY: "考研", COMMON: "通用",
  TEM4: "专四", TEM8: "专八", IELTS: "雅思", TOEFL: "托福",
};
const LEVELS = Object.keys(LEVEL_LABEL);

interface ImportForm {
  title: string;
  level: string;
  desc: string;
  content: string;
}

export default function WordLibraryPage() {
  const { status } = useSession();
  const [libs, setLibs] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ImportForm>({ title: "", level: "COMMON", desc: "", content: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/word-library");
    if (res.ok) {
      const d = await res.json();
      setLibs(d.libraries ?? []);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    load().finally(() => setLoading(false));
  }, [status]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setForm((f) => ({ ...f, content: f.content ? f.content + "\n" + text : text }));
    };
    reader.readAsText(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/word-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: `导入成功，共 ${data.count} 个单词` });
        setForm({ title: "", level: "COMMON", desc: "", content: "" });
        setShowForm(false);
        await load();
      } else {
        setMsg({ ok: false, text: data.error ?? "导入失败，请重试" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "unauthenticated") {
    return <div className="card mt-10 text-center">请先 <Link href="/login" className="text-brand-600">登录</Link> 查看单词库。</div>;
  }
  if (loading) return <p className="mt-10 text-center text-slate-400">加载中…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">我的单词库（{libs.length}）</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
          {showForm ? "收起" : "＋ 导入词库"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-6 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-500">词库名称（必填）</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="如 考研核心词"
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
              <label className="mb-1 block text-sm text-slate-500">简介（可选）</label>
              <input
                value={form.desc}
                onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                placeholder="一句话描述"
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-500">单词清单（每行一个，支持 `单词 | 中文释义`）</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder={"apple | 苹果\nbook | 书"}
              rows={8}
              className="input w-full font-mono text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-500">或从文件导入（.txt / .csv）</label>
            <input type="file" accept=".txt,.csv" onChange={onFile} className="block text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "导入中…" : "导入词库"}
            </button>
            {msg && (
              <span className={msg.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{msg.text}</span>
            )}
          </div>
        </form>
      )}

      {libs.length === 0 && (
        <div className="card mt-4 text-center text-slate-500">
          还没有导入的词库。点击右上角「＋ 导入词库」，粘贴单词清单或上传 .txt / .csv 文件。
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {libs.map((l) => (
          <Link key={l.id} href={`/word-library/${l.id}`} className="card hover:border-brand-300 hover:shadow">
            <div className="flex items-center justify-between">
              <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                {LEVEL_LABEL[l.level] ?? l.level}
              </span>
              <span className="text-xs text-slate-400">{l._count.words} 词</span>
            </div>
            <h3 className="mt-2 font-semibold text-slate-800">{l.title}</h3>
            {l.desc && <p className="mt-1 text-xs text-slate-400">{l.desc}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
