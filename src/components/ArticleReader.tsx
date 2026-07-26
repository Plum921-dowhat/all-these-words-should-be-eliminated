"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { speak } from "@/lib/tts";

interface LookupWord {
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

const WORD_RE = /[A-Za-z][A-Za-z'-]*/g;

export function ArticleReader({
  articleId,
  title,
  content,
  markedIds,
}: {
  articleId: string;
  title: string;
  content: string;
  markedIds: Set<string>;
}) {
  const { status } = useSession();
  const [popup, setPopup] = useState<{ word: string; info?: LookupWord; added: boolean; loading: boolean } | null>(null);
  const [marked, setMarked] = useState<Set<string>>(markedIds);

  const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  async function onClickToken(raw: string) {
    const word = raw.toLowerCase().replace(/[^a-z'-]/g, "");
    if (!word) return;
    setPopup({ word, loading: true, added: false });

    const res = await fetch(`/api/words/lookup?word=${encodeURIComponent(word)}`);
    const data = await res.json();
    const info: LookupWord | undefined = data.word ?? undefined;

    let added = false;
    if (status === "authenticated") {
      const m = await fetch("/api/words/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, articleId }),
      });
      if (m.ok) {
        added = true;
        const mid = (await m.json()).wordId;
        if (mid) setMarked((s) => new Set(s).add(mid));
      }
    }
    setPopup({ word, info, added, loading: false });
  }

  function renderParagraph(text: string) {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const tok = m[0];
      parts.push(
        <button
          key={`${m.index}-${tok}`}
          onClick={() => onClickToken(tok)}
          className="rounded px-0.5 text-left hover:bg-brand-50"
        >
          {tok}
        </button>
      );
      last = m.index + tok.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  return (
    <div className="relative">
      <h1 className="mb-4 text-2xl font-bold text-slate-800">{title}</h1>
      <article className="space-y-4 text-lg leading-8 text-slate-700">
        {paragraphs.map((p, i) => (
          <p key={i}>{renderParagraph(p)}</p>
        ))}
      </article>

      {popup && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/20" onClick={() => setPopup(null)}>
          <div className="mb-10 w-[90%] max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {popup.loading ? (
              <p className="text-slate-400">查询中…</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{popup.word}</h3>
                    {popup.info?.phoneticUs && <span className="text-sm text-slate-400">美 {popup.info.phoneticUs}</span>}
                  </div>
                  <button onClick={() => speak(popup.word)} className="btn-ghost px-2 py-1">🔊</button>
                </div>
                {popup.info?.definitionCn && <p className="mt-2 text-slate-700">{popup.info.definitionCn}</p>}
                {popup.info?.definitionEn && <p className="mt-1 text-sm text-slate-500">{popup.info.definitionEn}</p>}
                {!popup.info && <p className="mt-2 text-slate-400">词库暂无该词释义。</p>}
                <p className="mt-3 text-xs text-emerald-600">
                  {status === "authenticated"
                    ? popup.added
                      ? "✓ 已加入生词本，将在复习中出现"
                      : "已存在生词本"
                    : "登录后可加入生词本"}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
