"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flashcard, type CardWord } from "@/components/Flashcard";
import type { ReviewResult } from "@/lib/enums";

const BOARD_SIZE = 6; // 一次铺满一屏的卡数（3×2 网格）
const STORAGE_KEY = "roundSize";

type Phase = "menu" | "study" | "roundEnd";
type Mode = "new" | "review";

export default function LearnPage() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [mode, setMode] = useState<Mode | null>(null);
  const [queue, setQueue] = useState<CardWord[]>([]);
  const [studied, setStudied] = useState(0);
  const [sessionDone, setSessionDone] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ newCount: number; dueCount: number } | null>(null);
  const [roundSize, setRoundSize] = useState<number>(20);
  const loaded = useRef(false);

  // 读取上次设置的每组词卡数量
  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved >= 1) setRoundSize(saved);
  }, []);

  function loadStats() {
    fetch("/api/words/stats")
      .then((r) => r.json())
      .then((d) => setStats({ newCount: d.newCount ?? 0, dueCount: d.dueCount ?? 0 }))
      .catch(() => setStats({ newCount: 0, dueCount: 0 }));
  }

  useEffect(() => {
    if (phase === "menu") loadStats();
  }, [phase]);

  const board = queue.slice(0, BOARD_SIZE);

  async function startStudy(m: Mode) {
    setMode(m);
    setLoading(true);
    loaded.current = false;
    setStudied(0);
    setQueue([]);
    try {
      const limit = roundSize + BOARD_SIZE;
      const res = await fetch(`/api/words/due?mode=${m}&limit=${limit}`);
      const data = await res.json();
      const items: CardWord[] = (data.items ?? []).map((it: { word: CardWord }) => it.word);
      if (!items.length) {
        setPhase("roundEnd");
      } else {
        setQueue(items);
        loaded.current = true;
        setPhase("study");
      }
    } catch {
      setPhase("roundEnd");
    } finally {
      setLoading(false);
    }
  }

  // 评分回调：稳定引用，保证 Flashcard 的 memo 生效
  const handleResult = useCallback(
    async (word: CardWord, result: ReviewResult, durationMs: number) => {
      try {
        await fetch("/api/words/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordId: word.id, result, durationMs }),
        });
      } catch {
        /* 忽略网络错误，本地队列仍继续 */
      }
      setSessionDone((n) => n + 1);
      setStudied((s) => s + 1);
      setQueue((q) => {
        if (result === "AGAIN") {
          // 重新排队到末尾，本轮稍后再见
          return [...q.filter((x) => x.id !== word.id), word];
        }
        return q.filter((x) => x.id !== word.id);
      });
    },
    [],
  );

  // 满 roundSize 张 -> 本轮结束
  useEffect(() => {
    if (phase === "study" && studied >= roundSize) setPhase("roundEnd");
  }, [studied, roundSize, phase]);

  // 队列清空（且已加载过）-> 本轮结束
  useEffect(() => {
    if (phase === "study" && loaded.current && !loading && queue.length === 0) {
      setPhase("roundEnd");
    }
  }, [queue, loading, phase]);

  function applyRoundSize(v: number) {
    const n = Math.min(100, Math.max(1, Math.round(v) || 20));
    setRoundSize(n);
    localStorage.setItem(STORAGE_KEY, String(n));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">背单词</h1>

      {phase === "menu" && (
        <div className="space-y-6">
          <div className="card">
            <label className="mb-1 block text-sm font-medium text-slate-600">
              每组词卡数量
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={roundSize}
                onChange={(e) => applyRoundSize(Number(e.target.value))}
                className="input w-24"
              />
              <span className="text-sm text-slate-400">张（学习满此数量后进入本轮小结）</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              disabled={!stats || stats.newCount === 0}
              onClick={() => startStudy("new")}
              className="card text-left transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="text-lg font-semibold text-brand-700">学习新单词</div>
              <div className="mt-1 text-sm text-slate-500">
                从未学过的单词 · 共 {(stats?.newCount ?? 0)} 个
              </div>
            </button>
            <button
              disabled={!stats || stats.dueCount === 0}
              onClick={() => startStudy("review")}
              className="card text-left transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="text-lg font-semibold text-emerald-700">复习旧单词</div>
              <div className="mt-1 text-sm text-slate-500">
                到期待复习的单词 · 共 {(stats?.dueCount ?? 0)} 个
              </div>
            </button>
          </div>
        </div>
      )}

      {phase === "study" && (
        <div>
          <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
            <button onClick={() => setPhase("menu")} className="btn-ghost">
              ← 返回选择
            </button>
            <span>
              本轮 {Math.min(studied, roundSize)} / {roundSize} · 本次累计 {sessionDone}
            </span>
          </div>

          {loading ? (
            <p className="py-20 text-center text-slate-400">加载中…</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {board.map((w) => (
                <div key={w.id} className="card-flow h-[22rem]">
                  <Flashcard word={w} onResult={handleResult} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === "roundEnd" && (
        <div className="card mx-auto max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-800">本轮完成 🎉</h2>
          <p className="mt-2 text-slate-500">
            本轮学习了 {Math.min(studied, roundSize)} 个单词，本次累计 {sessionDone} 个。
          </p>
          <div className="mt-6 grid gap-3">
            <button
              onClick={() => startStudy("new")}
              className="btn bg-brand-600 text-white hover:bg-brand-700"
            >
              学习新单词（{stats?.newCount ?? 0}）
            </button>
            <button
              onClick={() => startStudy("review")}
              className="btn bg-emerald-600 text-white hover:bg-emerald-700"
            >
              复习旧单词（{stats?.dueCount ?? 0}）
            </button>
          </div>
          <button
            onClick={() => setPhase("menu")}
            className="btn-ghost mt-4 w-full"
          >
            返回菜单
          </button>
        </div>
      )}
    </main>
  );
}
