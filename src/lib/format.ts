// Helpers for rendering the Word.pos / Word.examples JSON-string columns.
// Both columns are stored as JSON strings in the DB (e.g. pos is
// [{"pos":"n.","def":"..."}] and examples is [{en, zh}]), but a user may also
// store a plain string such as "v." — these helpers tolerate both shapes.

export interface PosItem {
  pos?: string;
  def?: string;
}

export interface ExampleItem {
  en?: string;
  zh?: string;
}

export function parsePosJson(raw?: string | null): PosItem[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      return v
        .filter((x) => x && (x.pos || x.def))
        .map((x) => ({ pos: x.pos, def: x.def }));
    }
    if (v && typeof v === "object" && (v.pos || v.def)) {
      return [{ pos: v.pos, def: v.def }];
    }
    if (typeof v === "string") return [{ pos: v }];
  } catch {
    // Not JSON — treat the whole string as a single part-of-speech label.
    return [{ pos: raw }];
  }
  return [];
}

export function parseExamplesJson(raw?: string | null): ExampleItem[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      return v
        .filter((x) => x && (x.en || x.zh))
        .map((x) => ({ en: x.en, zh: x.zh }));
    }
    if (v && typeof v === "object" && (v.en || v.zh)) {
      return [{ en: v.en, zh: v.zh }];
    }
    if (typeof v === "string") return [{ en: v }];
  } catch {
    return [{ en: raw }];
  }
  return [];
}
