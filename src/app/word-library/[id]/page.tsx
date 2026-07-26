"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { speak } from "@/lib/tts";

interface Word {
  id: string;
  headword: string;
  phoneticUs?: string | null;
  pos?: string | null;
  definitionCn?: string | null;
}

interface LibraryInfo {
  id: string;
  title: string;
  desc: string | null;
  level: string;
}

const LEVEL_LABEL: Record<string, string> = {
  CET4: "四级", CET6: "六级", KY: "考研", COMMON: "通用",
  TEM4: "专四", TEM8: "专八", IELTS: "雅思", TOEFL: "托福",
};

export default function LibraryDetailPage() {
  const { id } = useParams() as { id: string };
  const { status } = useSession();
  const [lib, setLib] = useState<LibraryInfo | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const res = await fetch(`/api/word-library/${id}`);
    if (res.ok) {
      const d = await res.json();
      setLib(d.library);
      setWords(d.words ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (status === "authenticated") load();
    else setLoading(false);
  }, [id, status]);

  async function addAll() {
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/word-library/${id}`, { method: "POST" });
      const d = await res.json();
      if (res.ok) setMsg({ ok: true, text: d.added > 0 ? `已加入 ${d.added} 个单词到生词本` : "生词本中已包含这些单词" });
      else setMsg({ ok: false, text: d.error ?? "操作失败" });
    } finally {
      setAdding(false);
    }
  }

  if (status === "unauthenticated") {
    return <div className="card mt-10 text-center">请先 <Link href="/login" className="text-brand-600">登录</Link> 查看单词库。</div>;
  }
  if (loading) return <p className="mt-10 text-center text-slate-400">加载中…</p>;

  return (
    <div>
      <Link href="/word-library" className="text-sm text-brand-600">← 返回单词库</Link>
      <div className="mb-4 mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{lib?.title}</h1>
          <p className="mt-1 text-xs text-slate-400">
            {lib ? LEVEL_LABEL[lib.level] ?? lib.level : ""} · {words.length} 词
            {lib?.desc ? ` · ${lib.desc}` : ""}
          </p>
        </div>
        <button onClick={addAll} disabled={adding} className="btn-primary">
          {adding ? "加入中…" : "全部加入生词本"}
        </button>
      </div>

      {msg && (
        <p className={msg.ok ? "mb-3 text-sm text-emerald-600" : "mb-3 text-sm text-red-600"}>{msg.text}</p>
      )}

      {words.length === 0 && (
        <div className="card text-center text-slate-500">该词库暂无单词。</div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {words.map((w) => {
          let posLabel: string | null = null;
          try {
            const arr = w.pos ? JSON.parse(w.pos) : null;
            if (Array.isArray(arr) && arr[0]?.pos) posLabel = arr[0].pos;
          } catch { /* ignore */ }
          return (
            <div key={w.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{w.headword}</span>
                    {posLabel && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{posLabel}</span>
                    )}
                  </div>
                  {w.definitionCn && <p className="mt-1 text-sm text-slate-600">{w.definitionCn}</p>}
                </div>
                <button onClick={() => speak(w.headword)} className="btn-ghost px-2 py-1">🔊</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
