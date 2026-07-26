"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Flashcard, type CardWord } from "@/components/Flashcard";
import type { ReviewResult } from "@/lib/enums";

interface DueItem {
  word: CardWord;
}

export default function LearnPage() {
  const { status } = useSession();
  const [items, setItems] = useState<DueItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(0);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/words/due?limit=20");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
      setIdx(0);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status]);

  async function onResult(result: ReviewResult, durationMs: number) {
    const current = items[idx];
    if (!current) return;
    await fetch("/api/words/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: current.word.id, result, durationMs }),
    });
    setDone((d) => d + 1);
    if (idx + 1 >= items.length) {
      setItems([]);
    } else {
      setIdx((i) => i + 1);
    }
  }

  if (status === "unauthenticated") {
    return (
      <div className="card mt-10 text-center">
        <p>请先 <Link href="/login" className="text-brand-600">登录</Link> 后开始背单词。</p>
      </div>
    );
  }

  if (loading) return <p className="mt-10 text-center text-slate-400">加载中…</p>;

  if (items.length === 0) {
    return (
      <div className="card mt-10 text-center">
        <h2 className="text-xl font-semibold text-slate-700">🎉 今天的复习完成啦！</h2>
        <p className="mt-2 text-slate-500">本次共复习 {done} 个单词。去<Link href="/reading" className="text-brand-600">分级阅读</Link>遇到生词也会自动加入复习。</p>
        <button onClick={load} className="btn-ghost mt-4">再刷一批</button>
      </div>
    );
  }

  return (
    <div>
      <Flashcard
        key={items[idx].word.id}
        word={items[idx].word}
        index={idx}
        total={items.length}
        onResult={onResult}
      />
    </div>
  );
}
