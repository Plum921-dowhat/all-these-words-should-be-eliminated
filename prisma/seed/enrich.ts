// Enrich seed words with free dictionary APIs (no key required).
// Used by the seed pipeline to backfill audio / phonetics / EN definitions.
import { enrichWord } from "../../src/lib/api/dictionary";
import type { SeedWord } from "./data";

// Small concurrency-limited pool.
async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Try to enrich a word; fall back to the curated data on any failure.
export async function enrichSeed(words: SeedWord[]): Promise<SeedWord[]> {
  return mapPool(words, 5, async (w) => {
    try {
      const e = await enrichWord(w.headword);
      return {
        ...w,
        phoneticUs: w.phoneticUs ?? e.phoneticUs,
        definitionCn: w.definitionCn ?? e.definitionCn,
        pos: w.pos ?? e.pos,
        examples: w.examples ?? e.examples,
        // audio fields from API are best-effort
        ...(e.audioUsUrl ? { audioUsUrl: e.audioUsUrl } : {}),
      } as SeedWord & { audioUsUrl?: string };
    } catch {
      return w;
    }
  });
}
