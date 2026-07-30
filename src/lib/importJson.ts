// Shared helpers for importing words / articles from pasted text or uploaded
// text files. Supports both the legacy plain-text line format and a JSON
// structure (object or array). The three import APIs (word library, add word,
// article) all funnel through these helpers so behaviour stays consistent.

import type { ExamType } from "@/lib/enums";

export function normWord(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z'-]/g, "");
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

  let headRaw: string;
  let lineDefCn: string | undefined;
  let obj: Record<string, any> | null = null;

  if (typeof entry === "string") {
    const s = entry.trim();
    if (!s) return null;
    const m = s.match(/^(\S+)\s*[\|，,\t]\s*(.*)$/);
    headRaw = m ? m[1] : s;
    lineDefCn = m && m[2] ? m[2].trim() : undefined;
  } else if (Array.isArray(entry)) {
    if (entry[0] == null) return null;
    headRaw = String(entry[0]);
    lineDefCn = entry[1] != null ? String(entry[1]).trim() : undefined;
  } else if (typeof entry === "object") {
    const h = pickStr(entry, ["headword", "word", "term", "name", "spelling", "text"]);
    if (h == null) return null;
    headRaw = h;
    obj = entry;
  } else {
    return null;
  }

  const head = normWord(headRaw);
  if (!head) return null;

  const out: WordInput = { headword: head };

  const objCn = obj
    ? pickStr(obj, ["definitionCn", "def", "meaning", "cn", "definition", "trans", "translation"])
    : null;
  const cn = objCn ?? lineDefCn ?? null;
  out.definitionCn = cn ? cn.trim() || null : null;

  if (obj) {
    out.definitionEn = pickStr(obj, ["definitionEn", "en", "defEn"])?.trim() || null;
    out.phoneticUk = pickStr(obj, ["phoneticUk", "uk", "phonetic_uk"])?.trim() || null;
    out.phoneticUs = pickStr(obj, ["phoneticUs", "us", "phonetic_us"])?.trim() || null;
    out.pos = toJsonString(obj.pos);
    out.examples = toJsonString(obj.examples);
  }

  return out;
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
