"use client";

import { memo, useState } from "react";
import type { ReviewResult } from "@/lib/enums";
import { speak } from "@/lib/tts";

export interface CardWord {
  id: string;
  headword: string;
  phoneticUk?: string | null;
  phoneticUs?: string | null;
  audioUsUrl?: string | null;
  pos?: string | null;
  definitionCn?: string | null;
  definitionEn?: string | null;
  examples?: string | null;
}

// Memoized so each card keeps its own flip state and is NOT re-rendered when
// its siblings are judged (parent re-render only touches the changed card).
export const Flashcard = memo(function Flashcard({
  word,
  onResult,
}: {
  word: CardWord;
  onResult: (word: CardWord, result: ReviewResult, durationMs: number) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [start, setStart] = useState(Date.now());

  const posList = word.pos ? safeJson<{ pos: string; def: string }[]>(word.pos) : [];
  const exList = word.examples ? safeJson<{ en: string; zh: string }[]>(word.examples) : [];

  function play() {
    if (word.audioUsUrl) {
      new Audio(word.audioUsUrl).play().catch(() => speak(word.headword));
    } else {
      speak(word.headword);
    }
  }

  function flip() {
    setFlipped((f) => !f);
  }

  function handle(r: ReviewResult) {
    onResult(word, r, Date.now() - start);
  }

  return (
    <div className="card flex h-full flex-col">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="truncate">{word.headword}</span>
        <button onClick={play} className="btn-ghost px-2 py-1">🔊 朗读</button>
      </div>

      {/* 透视容器 */}
      <div className="perspective mt-3 min-h-0 flex-1">
        <div
          onClick={flip}
          className={`relative h-full min-h-[12rem] w-full cursor-pointer transition-transform duration-500 preserve-3d ${
            flipped ? "rotate-y-180" : ""
          }`}
        >
          {/* 正面：英文 */}
          <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center rounded-xl bg-white">
            <h2 className="text-2xl font-bold text-slate-800">{word.headword}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {word.phoneticUk && <span>英 {word.phoneticUk}</span>}
              {word.phoneticUs && <span className="ml-3">美 {word.phoneticUs}</span>}
            </p>
            <span className="mt-4 text-xs text-slate-400">点击卡片看释义</span>
          </div>

          {/* 背面：中文释义 + 例句 */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col justify-center overflow-y-auto rounded-xl bg-slate-50 p-4">
            {posList.map((p, i) => (
              <div key={i}>
                <span className="font-medium text-brand-700">{p.pos}</span>{" "}
                <span className="text-slate-700">{p.def}</span>
              </div>
            ))}
            {!posList.length && word.definitionCn && (
              <p className="text-slate-700">{word.definitionCn}</p>
            )}
            {word.definitionEn && (
              <p className="mt-1 text-sm text-slate-500">{word.definitionEn}</p>
            )}
            {exList.map((e, i) => (
              <div key={i} className="mt-2 rounded-lg bg-white p-2 text-sm">
                <p className="text-slate-700">{e.en}</p>
                {e.zh && <p className="text-slate-400">{e.zh}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 评分始终在正面显示，无需翻面 */}
      <div className="grid grid-cols-4 gap-1.5 pt-3">
        <button onClick={() => handle("AGAIN")} className="btn bg-red-50 text-red-600 hover:bg-red-100 text-xs">忘记</button>
        <button onClick={() => handle("HARD")} className="btn bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs">困难</button>
        <button onClick={() => handle("GOOD")} className="btn bg-sky-50 text-sky-600 hover:bg-sky-100 text-xs">良好</button>
        <button onClick={() => handle("EASY")} className="btn bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs">简单</button>
      </div>
    </div>
  );
});

function safeJson<T>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return [] as unknown as T;
  }
}
