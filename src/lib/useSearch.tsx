"use client";

import { useEffect, useState, type ReactNode } from "react";

// Debounce a value (default 150ms) to avoid filtering on every keystroke.
export function useDebounced<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Safe highlight: wraps matched substring in <mark>. Never uses
// dangerouslySetInnerHTML, so it is XSS-safe.
export function highlight(text: string | null | undefined, q: string): ReactNode {
  if (!text) return text ?? "";
  const query = q.trim();
  if (!query) return text;
  const lower = text.toLowerCase();
  const ql = query.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(ql, i);
  let k = 0;
  while (idx !== -1) {
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark key={k++} className="rounded bg-amber-200 px-0.5 text-slate-900">
        {text.slice(idx, idx + ql.length)}
      </mark>,
    );
    i = idx + ql.length;
    idx = lower.indexOf(ql, i);
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}
