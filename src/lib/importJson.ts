// Shared helpers for importing words / articles from pasted text or uploaded
// text files. Supports both the legacy plain-text line format and a JSON
// structure (object or array). The three import APIs (word library, add word,
// article) all funnel through these helpers so behaviour stays consistent.

import type { ExamType } from "@/lib/enums";

export function normWord(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z'-]/g, "");
}

// Known part-of-speech tags, ordered longest-first so e.g. `adj.` is not
// partially matched by a shorter tag. `\b` guards require a word boundary so
// tags don't fire inside other words (e.g. `v.` inside `adv.`).
const POS_TAGS = [
  "vt.", "vi.", "v.", "n.", "adj.", "adv.", "prep.", "conj.", "pron.",
  "num.", "int.", "art.", "aux.", "abbr.", "pl.", "sb.", "sth.",
];

// Split a `词性. 释义` remainder like
//   "v. 1. 抛弃 2. 离弃...  n. 废除"
// into structured [{ pos, def }] entries.
function splitPos(rest: string): { pos: string; def: string }[] {
  if (!rest.trim()) return [];
  const re = new RegExp(
    `\\b(${POS_TAGS.map((t) => t.replace(/\./g, "\\.")).join("|")})\\s*`,
    "gi"
  );
  const matches = [...rest.matchAll(re)];
  if (matches.length === 0) return [{ pos: "", def: rest.trim() }];
  const out: { pos: string; def: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? rest.length) : rest.length;
    const seg = rest.slice(start, end).trim();
    if (seg) out.push({ pos: m[1].trim(), def: seg });
  }
  return out;
}

// Parse one line of word text. Supports three formats:
//   1) word | 中文释义          (separator: | ， , or tab)
//   2) word [音标] 词性. 释义    (dictionary style, multi-sense -> structured pos)
//   3) word                    (headword only)
export function parseWordLine(line: string): WordInput | null {
  const raw = line.trim();
  if (!raw) return null;

  // 1) Separator format
  const sep = raw.match(/^(\S+)\s*[\|，,\t]\s*(.*)$/);
  if (sep) {
    const head = normWord(sep[1]);
    if (!head) return null;
    return { headword: head, definitionCn: sep[2].trim() || null };
  }

  // 2) Dictionary style: word [音标] 词性. 释义
  const dict = raw.match(/^(\S+)\s*\[([^\]]*)\]\s*(.*)$/);
  if (dict) {
    const head = normWord(dict[1]);
    if (!head) return null;
    const phonetic = dict[2].trim() || null;
    const rest = dict[3].trim();
    const posList = rest ? splitPos(rest) : [];
    const out: WordInput = { headword: head };
    if (phonetic) out.phoneticUs = phonetic;
    // Multi-sense goes into structured `pos`; also backfill `definitionCn`
    // with the first sense so the plain-text lookup popup can render it.
    if (posList.length > 0) {
      out.pos = JSON.stringify(posList);
      out.definitionCn = posList[0].def || null;
    } else if (rest) {
      out.definitionCn = rest;
    }
    return out;
  }

  // 3) Bare headword
  const head = normWord(raw);
  if (!head) return null;
  return { headword: head };
}

// Try to parse `text` as JSON. Returns null when it is not valid JSON or does
// not look like JSON (so plain-text line input falls through unchanged).
export function tryParseJson(text: string): unknown | null {
  const t = text.trim();
  if (!t || !/^[\[{]/.test(t)) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// Normalized word shape that all importers can upsert into the Word table.
export interface WordInput {
  headword: string;
  definitionCn?: string | null;
  definitionEn?: string | null;
  phoneticUk?: string | null;
  phoneticUs?: string | null;
  pos?: string | null;
  examples?: string | null;
}

function pickStr(obj: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}

// Accept a string or an object/array. Strings/arrays are stored verbatim
// (trimmed); objects/arrays are serialized to JSON to match the schema.
function toJsonString(v: any): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s || null;
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return null;
    }
  }
  return String(v);
}

// Turn one JSON entry (string | 2-tuple | object) into a normalized WordInput.
// Returns null when there is no usable headword.
export function normalizeWordEntry(entry: any): WordInput | null {
  if (entry == null) return null;
  if (typeof entry === "string") return parseWordLine(entry);

  if (Array.isArray(entry)) {
    if (entry[0] == null) return null;
    const head = normWord(String(entry[0]));
    if (!head) return null;
    const out: WordInput = { headword: head };
    if (entry[1] != null) out.definitionCn = String(entry[1]).trim() || null;
    return out;
  }

  if (typeof entry === "object") {
    const h = pickStr(entry, ["headword", "word", "term", "name", "spelling", "text"]);
    if (h == null) return null;
    const head = normWord(h);
    if (!head) return null;
    const out: WordInput = { headword: head };
    out.definitionCn = pickStr(entry, ["definitionCn", "def", "meaning", "cn", "definition", "trans", "translation"])?.trim() || null;
    out.definitionEn = pickStr(entry, ["definitionEn", "en", "defEn"])?.trim() || null;
    out.phoneticUk = pickStr(entry, ["phoneticUk", "uk", "phonetic_uk"])?.trim() || null;
    out.phoneticUs = pickStr(entry, ["phoneticUs", "us", "phonetic_us"])?.trim() || null;
    out.pos = toJsonString(entry.pos);
    out.examples = toJsonString(entry.examples);
    return out;
  }
  return null;
}

// Build the create/update payloads for `prisma.word.upsert`. Only non-null
// fields are written on update so existing richer data is never clobbered.
export function buildWordData(input: WordInput) {
  const create: Record<string, any> = { headword: input.headword };
  const update: Record<string, any> = {};
  for (const key of [
    "definitionCn",
    "definitionEn",
    "phoneticUk",
    "phoneticUs",
    "pos",
    "examples",
  ] as const) {
    const v = input[key];
    if (v != null) {
      create[key] = v;
      update[key] = v;
    }
  }
  return { create, update };
}

// Pull a list of word entries out of a parsed JSON value.
export function extractWordList(js: unknown): any[] | null {
  if (Array.isArray(js)) return js;
  if (js && typeof js === "object") {
    const o = js as Record<string, any>;
    if (Array.isArray(o.words)) return o.words;
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.list)) return o.list;
    return [o]; // a single bare word object
  }
  return null;
}

// Pull a list of article objects out of a parsed JSON value.
export function extractArticleList(js: unknown): any[] | null {
  if (Array.isArray(js)) return js;
  if (js && typeof js === "object") {
    const o = js as Record<string, any>;
    if (Array.isArray(o.articles)) return o.articles;
    if (Array.isArray(o.list)) return o.list;
    return [o]; // a single bare article object
  }
  return null;
}

export function asExamType(v: any, fallback: ExamType): ExamType {
  return v && typeof v === "string" ? (v as ExamType) : fallback;
}
