"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { speak } from "@/lib/tts";
import { WordFields } from "@/components/WordFields";
import { useDebounced, highlight } from "@/lib/useSearch";

interface WbItem {
  word: {
    id: string;
    headword: string;
    phoneticUs?: string | null;
    audioUsUrl?: string | null;
    definitionCn?: string | null;
    pos?: string | null;
    examples?: string | null;
  };
  status: string;
  familiarity: number;
  nextReviewAt: string;
  lastGrade?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  NEW: "未学", LEARNING: "学习中", REVIEWING: "复习中", MASTERED: "已掌握",
};

const GRADE_LABEL: Record<string, string> = {
  AGAIN: "忘记", HARD: "困难", GOOD: "良好", EASY: "简单",
};

type TabKey = "全部" | "忘记" | "困难" | "良好" | "简单" | "未学";
const TABS: TabKey[] = ["全部", "忘记", "困难", "良好", "简单", "未学"];

function gradeToTab(g?: string | null): TabKey {
  if (g === "AGAIN") return "忘记";
  if (g === "HARD") return "困难";
  if (g === "GOOD") return "良好";
  if (g === "EASY") return "简单";
  return "未学";
}

interface AddForm {
  headword: string;
  phoneticUk: string;
  phoneticUs: string;
  definitionCn: string;
  definitionEn: string;
}

export default function WordbookPage() {
  const { status } = useSession();
  const [items, setItems] = useState<WbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("全部");
  const [query, setQuery] = useState("");

  // 手动添加表单状态
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddForm>({
    headword: "", phoneticUk: "", phoneticUs: "", definitionCn: "", definitionEn: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 批量 JSON 导入状态
  const [showBatch, setShowBatch] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchMsg, setBatchMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 批量管理模式状态
  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    const res = await fetch("/api/words/list");
    if (res.ok) {
      const d = await res.json();
      setItems(d.items ?? []);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    load().finally(() => setLoading(false));
  }, [status]);

  // 统计各类数量
  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { 全部: items.length, 忘记: 0, 困难: 0, 良好: 0, 简单: 0, 未学: 0 };
    for (const it of items) c[gradeToTab(it.lastGrade)] += 1;
    return c;
  }, [items]);

  const debouncedQuery = useDebounced(query, 150);
  const filtered = useMemo(() => {
    const base = tab === "全部" ? items : items.filter((it) => gradeToTab(it.lastGrade) === tab);
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (it) =>
        (it.word.headword ?? "").toLowerCase().includes(q) ||
        (it.word.definitionCn ?? "").toLowerCase().includes(q)
    );
  }, [items, tab, debouncedQuery]);

  async function removeWord(wordId: string) {
    if (!window.confirm("确定从生词本中删除该单词吗？")) return;
    const res = await fetch(`/api/words/${wordId}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((it) => it.word.id !== wordId));
  }

  // 批量管理：选择 / 全选 / 批量删除
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = filtered.map((it) => it.word.id);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function exitManage() {
    setManageMode(false);
    setSelected(new Set());
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${ids.length} 个单词吗？`)) return;
    const res = await fetch("/api/words/batch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((it) => !selected.has(it.word.id)));
      setSelected(new Set());
    }
  }

  // 输入单词后失焦时，查词库自动预填释义/音标
  async function onHeadwordBlur() {
    const w = form.headword.trim();
    if (!w) return;
    const res = await fetch(`/api/words/lookup?word=${encodeURIComponent(w)}`);
    const data = await res.json();
    if (data.word) {
      setForm((f) => ({
        ...f,
        phoneticUk: data.word.phoneticUk ?? f.phoneticUk,
        phoneticUs: data.word.phoneticUs ?? f.phoneticUs,
        definitionCn: data.word.definitionCn ?? f.definitionCn,
        definitionEn: data.word.definitionEn ?? f.definitionEn,
      }));
    }
  }

  async function addWord(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/words/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: data.alreadyExisted ? "该词已在生词本中（已为你置顶显示）" : "添加成功！" });
        setForm({ headword: "", phoneticUk: "", phoneticUs: "", definitionCn: "", definitionEn: "" });
        await load();
      } else {
        setMsg({ ok: false, text: res.status === 400 ? "请输入有效的单词" : "添加失败，请重试" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "unauthenticated") {
    return <div className="card mt-10 text-center">请先 <Link href="/login" className="text-brand-600">登录</Link> 查看生词本。</div>;
  }
  if (loading) return <p className="mt-10 text-center text-slate-400">加载中…</p>;

  async function importBatch(e: React.FormEvent) {
    e.preventDefault();
    setBatchSubmitting(true);
    setBatchMsg(null);
    try {
      const parsed = JSON.parse(batchText);
      const res = await fetch("/api/words/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (res.ok) {
        setBatchMsg({ ok: true, text: `导入成功：新增 ${data.added}/${data.total} 个单词到生词本` });
        setBatchText("");
        await load();
      } else {
        setBatchMsg({ ok: false, text: data.error ?? "导入失败，请重试" });
      }
    } catch {
      setBatchMsg({ ok: false, text: "JSON 解析失败，请检查格式" });
    } finally {
      setBatchSubmitting(false);
    }
  }

  function onBatchFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBatchText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">我的生词本（{items.length}）</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowForm((s) => !s); setShowBatch(false); }}
            className="btn-primary"
          >
            {showForm ? "收起单条" : "＋ 添加单词"}
          </button>
          <button
            onClick={() => { setShowBatch((s) => !s); setShowForm(false); }}
            className="btn-ghost border border-brand-200 text-brand-700"
          >
            {showBatch ? "收起批量" : "＋ 批量 JSON 导入"}
          </button>
          <button
            onClick={() => (manageMode ? exitManage() : setManageMode(true))}
            className={
              manageMode
                ? "btn-primary"
                : "btn-ghost border border-brand-200 text-brand-700"
            }
          >
            {manageMode ? "退出批量管理" : "批量管理"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={addWord} className="card mb-6 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-500">单词（必填）</label>
            <input
              value={form.headword}
              onChange={(e) => setForm((f) => ({ ...f, headword: e.target.value }))}
              onBlur={onHeadwordBlur}
              placeholder="如 apple"
              className="input w-full"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-500">英式音标</label>
              <input value={form.phoneticUk} onChange={(e) => setForm((f) => ({ ...f, phoneticUk: e.target.value }))} placeholder="/ˈæp.əl/" className="input w-full" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-500">美式音标</label>
              <input value={form.phoneticUs} onChange={(e) => setForm((f) => ({ ...f, phoneticUs: e.target.value }))} placeholder="/ˈæp.əl/" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-500">中文释义</label>
            <input value={form.definitionCn} onChange={(e) => setForm((f) => ({ ...f, definitionCn: e.target.value }))} placeholder="苹果；n." className="input w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-500">英文释义（可选）</label>
            <input value={form.definitionEn} onChange={(e) => setForm((f) => ({ ...f, definitionEn: e.target.value }))} placeholder="a round fruit..." className="input w-full" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "添加中…" : "添加到生词本"}
            </button>
            {msg && (
              <span className={msg.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{msg.text}</span>
            )}
          </div>
          <p className="text-xs text-slate-400">提示：输入单词并移开光标后，若词库已有该词会自动填充音标与释义；也可手动补充。</p>
        </form>
      )}

      {showBatch && (
        <form onSubmit={importBatch} className="card mb-6 space-y-3">
          <p className="text-sm text-slate-500">
            批量加入生词本。粘贴 JSON 数组或 <code>{"{words:[...]}"}</code>，每条可为对象、
            <code>"word | 释义"</code> 字符串或 <code>["word","释义"]</code> 二元组，兼容 <code>headword/word</code>、<code>definitionCn/def</code>、<code>phoneticUs/us</code> 等字段名。
          </p>
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={'[\n  {"headword":"apple","definitionCn":"苹果","phoneticUs":"/ˈæp.əl/","examples":"I eat an apple."},\n  {"headword":"book","definitionCn":"书"}\n]'}
            rows={8}
            className="input w-full font-mono text-sm"
            required
          />
          <div>
            <label className="mb-1 block text-sm text-slate-500">或从文件导入（.json / .txt）</label>
            <input type="file" accept=".json,.txt" onChange={onBatchFile} className="block text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={batchSubmitting} className="btn-primary">
              {batchSubmitting ? "导入中…" : "批量导入生词本"}
            </button>
            {batchMsg && (
              <span className={batchMsg.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{batchMsg.text}</span>
            )}
          </div>
        </form>
      )}

      {manageMode && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
          <button onClick={toggleAll} className="btn-ghost border border-brand-300 text-brand-700">
            全选 / 取消全选
          </button>
          <span className="text-sm text-brand-700">已选 {selected.size} 个</span>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="btn-primary disabled:opacity-50"
          >
            删除选中
          </button>
          <button onClick={exitManage} className="btn-ghost text-slate-500">
            退出
          </button>
        </div>
      )}

      {/* 搜索框 */}
      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索生词本（单词 / 释义）…"
          className="input w-full"
        />
        <p className="mt-1 text-xs text-slate-400">找到 {filtered.length} / {items.length} 个</p>
      </div>

      {/* 统计 chips + 标签页 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-full px-3 py-1 text-sm transition " +
              (tab === t
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200")
            }
          >
            {t} {counts[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card text-center text-slate-500">
          {items.length === 0
            ? <>还没有生词。去<Link href="/reading" className="text-brand-600">分级阅读</Link>点击生词，或点击右上角「＋ 添加单词」。</>
            : "该分类下暂无单词。"}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((it) => (
          <div key={it.word.id} className="card card-flow">
            <div className="flex items-start justify-between">
              {manageMode && (
                <input
                  type="checkbox"
                  className="mt-1 mr-2 h-4 w-4"
                  checked={selected.has(it.word.id)}
                  onChange={() => toggleSelect(it.word.id)}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{highlight(it.word.headword, debouncedQuery)}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {STATUS_LABEL[it.status] ?? it.status}
                  </span>
                  {it.lastGrade && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      {GRADE_LABEL[it.lastGrade]}
                    </span>
                  )}
                </div>
                {it.word.definitionCn && <p className="mt-1 text-sm text-slate-600">{highlight(it.word.definitionCn, debouncedQuery)}</p>}
                <WordFields pos={it.word.pos} examples={it.word.examples} />
                <p className="mt-1 text-xs text-slate-400">
                  熟悉度 {it.familiarity}/5 · 下次复习 {new Date(it.nextReviewAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!manageMode && (
                  <button
                    onClick={() => removeWord(it.word.id)}
                    title="从生词本删除"
                    className="btn-ghost px-2 py-1 text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
                <button onClick={() => speak(it.word.headword)} className="btn-ghost px-2 py-1">🔊</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
