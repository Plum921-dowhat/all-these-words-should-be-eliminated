// 词根/词缀字典：作为静态 JSON（public/wordroot.json）在页面中使用，不进数据库。

export const ROOT_LIBRARY_ID = "roots";

export interface RootEntry {
  meaning?: string;
  class?: string;
  root?: string;
  example?: string[];
  origin?: string;
  antonyms?: string;
  synonyms?: string;
}

export type RootDict = Record<string, RootEntry>;

export interface RootItem {
  key: string;
  entry: RootEntry;
}

let cache: RootDict | null = null;

export async function loadWordRoots(): Promise<RootDict> {
  if (cache) return cache;
  const res = await fetch("/wordroot.json");
  if (!res.ok) throw new Error("无法加载词根数据");
  cache = (await res.json()) as RootDict;
  return cache;
}

export function toRootItems(dict: RootDict): RootItem[] {
  return Object.entries(dict).map(([key, entry]) => ({ key, entry }));
}

// "a-1, an-1" -> ["a-1", "an-1"]
export function splitRefs(s?: string): string[] {
  return (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
