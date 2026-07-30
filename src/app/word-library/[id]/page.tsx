"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { speak } from "@/lib/tts";
import { WordFields } from "@/components/WordFields";
import { ROOT_LIBRARY_ID, loadWordRoots, toRootItems, splitRefs, type RootItem } from "@/lib/wordroot";
import { useDebounced, highlight } from "@/lib/useSearch";

interface Word {
  id: string;
  headword: string;
  phoneticUs?: string | null;
  pos?: string | null;
  definitionCn?: string | null;
  examples?: string | null;
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
  const [rootItems, setRootItems] = useState<RootItem[]>([]);
  const [rootQuery, setRootQuery] = useState("");
  const [rootField, setRootField] = useState<"all" | "key" | "meaning" | "example">("all");
  const [wordQuery, setWordQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isRoot = id === ROOT_LIBRARY_ID;
  const debouncedRoot = useDebounced(rootQuery, 150);
  const debouncedWord = useDebounced(wordQuery, 150);

  const MAX_ROOT_RESULTS = 100;
  const rootFiltered = useMemo(() => {
    const q = debouncedRoot.trim().toLowerCase();
    if (q.length < 2) return rootItems; // 单字符不搜索，避免命中全量导致过载
    return rootItems.filter((it) => {
      const fields =
        rootField === "key"
          ? [it.key]
          : rootField === "meaning"
          ? [it.entry.meaning ?? ""]
          : rootField === "example"
          ? (it.entry.example ?? [])
          : [it.key, it.entry.meaning ?? "", ...(it.entry.example ?? [])];
      return fields.some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [rootItems, debouncedRoot, rootField]);

  const rootShown = rootFiltered.slice(0, MAX_ROOT_RESULTS);
  const rootTruncated = rootFiltered.length > rootShown.length;
  // 仅当用户输入了 1 个字符时才提示（空查询正常展示全量）
  const rootIsTooShort = debouncedRoot.trim().length === 1;
  // 单字符时不高亮，避免全量卡片被高亮成海量节点
  const rootHL = rootIsTooShort ? "" : debouncedRoot;

  async function load() {
    try {
      if (isRoot) {
        const dict = await loadWordRoots();
        setLib({ id: ROOT_LIBRARY_ID, title: "词根词缀库", desc: "英文词根 / 词缀速查", level: "COMMON" });
        setRootItems(toRootItems(dict));
      } else {
        const res = await fetch(`/api/word-library/${id}`);
        if (res.ok) {
          const d = await res.json();
          setLib(d.library);
          setWords(d.words ?? []);
        }
      }
    } finally {
      setLoading(false);
    }
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
            {lib ? LEVEL_LABEL[lib.level] ?? lib.level : ""} · {isRoot ? `${rootItems.length} 词根词缀` : `${words.length} 词`}
            {lib?.desc ? ` · ${lib.desc}` : ""}
          </p>
        </div>
        {!isRoot && (
          <button onClick={addAll} disabled={adding} className="btn-primary">
            {adding ? "加入中…" : "全部加入生词本"}
          </button>
        )}
      </div>

      {msg && (
        <p className={msg.ok ? "mb-3 text-sm text-emerald-600" : "mb-3 text-sm text-red-600"}>{msg.text}</p>
      )}

      {isRoot ? (
        <>
          <div className="mb-3 space-y-2">
            <input
              value={rootQuery}
              onChange={(e) => setRootQuery(e.target.value)}
              placeholder="搜索词根 / 含义 / 例词…"
              className="input w-full"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(["all", "key", "meaning", "example"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setRootField(f)}
                  className={`rounded-full px-3 py-1 ${
                    rootField === f ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {f === "all" ? "全部" : f === "key" ? "词根" : f === "meaning" ? "含义" : "例词"}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-2 text-xs text-slate-400">找到 {rootFiltered.length} / {rootItems.length} 条</p>
          {rootIsTooShort && (
            <div className="card mb-3 text-center text-sm text-amber-600">
              请输入至少 2 个字符以搜索（单字符匹配量过大）。
            </div>
          )}
          {!rootIsTooShort && rootFiltered.length === 0 ? (
            <div className="card text-center text-slate-500">未找到匹配的词根 / 词缀。</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rootShown.map((it) => {
                const syns = splitRefs(it.entry.synonyms);
                const ants = splitRefs(it.entry.antonyms);
                return (
                  <div key={it.key} className="card card-flow">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold">{highlight(it.key, rootHL)}</span>
                      {it.entry.class && (
                        <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                          {it.entry.class}
                        </span>
                      )}
                      {it.entry.origin && (
                        <span className="text-xs text-slate-400">{it.entry.origin}</span>
                      )}
                    </div>
                    {it.entry.meaning && (
                      <p className="mt-1 text-sm text-slate-600">{highlight(it.entry.meaning, rootHL)}</p>
                    )}
                    {it.entry.example && it.entry.example.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {it.entry.example.map((ex) => (
                          <span
                            key={ex}
                            className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {highlight(ex, rootHL)}
                          </span>
                        ))}
                      </div>
                    )}
                    {(syns.length > 0 || ants.length > 0) && (
                      <div className="mt-2 space-y-1 text-xs">
                        {syns.length > 0 && (
                          <div>
                            <span className="text-slate-400">同义：</span>
                            {syns.map((r) => (
                              <button
                                key={r}
                                onClick={() => setRootQuery(r)}
                                className="ml-1 text-brand-600 underline"
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                        {ants.length > 0 && (
                          <div>
                            <span className="text-slate-400">反义：</span>
                            {ants.map((r) => (
                              <button
                                key={r}
                                onClick={() => setRootQuery(r)}
                                className="ml-1 text-brand-600 underline"
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {rootTruncated && (
            <p className="mt-3 text-xs text-slate-400">
              已显示前 {rootShown.length} 条，共 {rootFiltered.length} 条匹配，请输入更精确的查询词。
            </p>
          )}
        </>
      ) : (
        <>
          <input
            value={wordQuery}
            onChange={(e) => setWordQuery(e.target.value)}
            placeholder="搜索单词 / 释义…"
            className="input mb-4 w-full"
          />
          {words.length === 0 ? (
            <div className="card text-center text-slate-500">该词库暂无单词。</div>
          ) : (
            (() => {
              const q = debouncedWord.trim().toLowerCase();
              const filtered = q
                ? words.filter(
                    (w) =>
                      (w.headword ?? "").toLowerCase().includes(q) ||
                      (w.definitionCn ?? "").toLowerCase().includes(q)
                  )
                : words;
              return (
                <>
                  <p className="mb-2 text-xs text-slate-400">找到 {filtered.length} / {words.length} 个单词</p>
                  {filtered.length === 0 ? (
                    <div className="card text-center text-slate-500">未找到匹配单词。</div>
                  ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filtered.map((w) => (
                      <div key={w.id} className="card card-flow">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold">{highlight(w.headword, debouncedWord)}</span>
                                {w.phoneticUs && <span className="text-sm text-slate-400">/{w.phoneticUs}/</span>}
                              </div>
                              {w.definitionCn && <p className="mt-1 text-sm text-slate-600">{highlight(w.definitionCn, debouncedWord)}</p>}
                              <WordFields pos={w.pos} examples={w.examples} />
                            </div>
                            <button onClick={() => speak(w.headword)} className="btn-ghost px-2 py-1">🔊</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()
          )}
        </>
      )}
    </div>
  );
}
