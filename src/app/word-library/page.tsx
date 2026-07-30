"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ROOT_LIBRARY_ID } from "@/lib/wordroot";

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
  const [query, setQuery] = useState("");

  async function load() {
    const res = await fetch("/api/word-library");
    if (res.ok) {
      const d = await res.json();
      setLibs(d.libraries ?? []);
    }
  }

  async function remove(id: string) {
    if (!confirm("确定删除该词库？仅删除词库与单词的关联，不影响生词本中的学习记录。")) return;
    const res = await fetch(`/api/word-library/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMsg({ ok: true, text: "已删除词库" });
      await load();
    } else {
      setMsg({ ok: false, text: "删除失败" });
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return libs;
    return libs.filter((l) => {
      const label = LEVEL_LABEL[l.level] ?? l.level;
      return (
        l.title.toLowerCase().includes(q) ||
        (l.desc ?? "").toLowerCase().includes(q) ||
        label.toLowerCase().includes(q)
      );
    });
  }, [libs, query]);

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    load().finally(() => setLoading(false));
  }, [status]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "").trim();
      if (!text) return;

      // Detect JSON import: prefill metadata and put the raw text into content.
      const patch: Partial<ImportForm> = { content: text };
      try {
        const js = JSON.parse(text);
        if (js && typeof js === "object" && !Array.isArray(js)) {
          if (js.title && !form.title) patch.title = String(js.title);
          if (js.desc != null && !form.desc) patch.desc = String(js.desc);
          if (js.level && LEVELS.includes(js.level)) patch.level = js.level;
        }
      } catch {
        // Not JSON — keep it as plain-text line content (append if needed).
        patch.content = form.content ? form.content + "\n" + text : text;
      }
      setForm((f) => ({ ...f, ...patch }));
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

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索词库名称 / 难度（如 六级、考研）…"
        className="input mb-4 w-full"
      />

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
            <label className="mb-1 block text-sm text-slate-500">单词清单（支持三种格式，每行一个）</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder={'abandon [əˈbændən] v. 1. 抛弃，放弃 2. 离弃\nabnormal [æbˈnɔːməl] adj. 不正常的\n\n或：apple | 苹果\nbook | 书\n\n或 JSON：\n{"title":"考研核心词","words":[{"headword":"apple","definitionCn":"苹果"}]}'}
              rows={8}
              className="input w-full font-mono text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-500">或从文件导入（.txt / .csv / .json）</label>
            <input type="file" accept=".txt,.csv,.json" onChange={onFile} className="block text-sm" />
            <p className="mt-1 text-xs text-slate-400">JSON 文件将自动识别并预填名称/难度/简介，支持 <code>{"{title, level, desc, words:[...]}"}</code> 或纯单词数组。</p>
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
          还没有导入的词库。点击右上角「＋ 导入词库」，粘贴单词清单或上传 .txt / .csv / .json 文件。
        </div>
      )}
      {libs.length > 0 && filtered.length === 0 && (
        <div className="card mt-4 text-center text-slate-500">
          未找到匹配「{query}」的词库。
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((l) => (
          <div key={l.id} className="card hover:border-brand-300 hover:shadow relative flex items-center justify-between gap-3">
            <Link href={`/word-library/${l.id}`} className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                  {LEVEL_LABEL[l.level] ?? l.level}
                </span>
                <span className="text-xs text-slate-400">{l._count.words} 词</span>
              </div>
              <h3 className="mt-2 font-semibold text-slate-800">{l.title}</h3>
              {l.desc && <p className="mt-1 text-xs text-slate-400">{l.desc}</p>}
            </Link>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(l.id); }}
              title="删除词库"
              className="btn-ghost shrink-0 px-2 py-1 text-slate-400 hover:text-red-600"
            >🗑</button>
          </div>
        ))}
        <Link key="roots" href={`/word-library/${ROOT_LIBRARY_ID}`} className="card hover:border-brand-300 hover:shadow">
          <div className="flex items-center justify-between">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">词根</span>
            <span className="text-xs text-slate-400">词根词缀</span>
          </div>
          <h3 className="mt-2 font-semibold text-slate-800">词根词缀库</h3>
          <p className="mt-1 text-xs text-slate-400">英文词根 / 词缀速查</p>
        </Link>
      </div>
    </div>
  );
}
