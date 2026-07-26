// Free dictionary enrichment — no API key required.
// Primary: Youdao jsonapi (Chinese definitions + phonetics)
// Fallback: dictionaryapi.dev (English defs + IPA + audio)

export interface DictEntry {
  word: string;
  phoneticUk?: string;
  phoneticUs?: string;
  audioUkUrl?: string;
  audioUsUrl?: string;
  pos?: string; // JSON: [{pos, def}]
  definitionCn?: string;
  definitionEn?: string;
  examples?: string; // JSON: [{en, zh}]
  difficulty?: number;
}

interface YoudaoResponse {
  ec?: {
    word?: Array<{
      ukphone?: string;
      usphone?: string;
      trs?: Array<{
        tr?: Array<{ pos?: string; gen?: string; interest?: string; tr?: unknown }>;
      }>;
    }>;
  };
  auth_sentence?: Array<{ source?: string; trans?: string; sentence?: string }>;
}

function parseYoudao(json: YoudaoResponse): Partial<DictEntry> {
  const w = json.ec?.word?.[0];
  if (!w) return {};
  const pos: { pos: string; def: string }[] = [];
  let definitionCn = "";
  w.trs?.forEach((tr) => {
    tr.tr?.forEach((t) => {
      const p = (t.pos ?? "").trim();
      const d = String(t.gen ?? t.interest ?? "").trim();
      if (d) {
        pos.push({ pos: p, def: d });
        definitionCn += (definitionCn ? "；" : "") + (p ? `${p} ${d}` : d);
      }
    });
  });
  const examples = (json.auth_sentence ?? [])
    .slice(0, 3)
    .map((s) => ({ en: s.sentence ?? "", zh: s.trans ?? "" }))
    .filter((e) => e.en);
  return {
    phoneticUk: w.ukphone,
    phoneticUs: w.usphone,
    pos: pos.length ? JSON.stringify(pos) : undefined,
    definitionCn: definitionCn || undefined,
    examples: examples.length ? JSON.stringify(examples) : undefined,
  };
}

async function fetchYoudao(word: string): Promise<Partial<DictEntry>> {
  const url = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return {};
  return parseYoudao((await res.json()) as YoudaoResponse);
}

async function fetchDictionaryApi(word: string): Promise<Partial<DictEntry>> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return {};
    const data = (await res.json()) as any[];
    const first = data[0];
    const phoneticUs = first?.phonetic ?? first?.phonetics?.find((p: any) => p.text)?.text;
    const audioUsUrl = first?.phonetics?.find((p: any) => p.audio)?.audio;
    const defs: string[] = [];
    first?.meanings?.forEach((m: any) => {
      const d = m.definitions?.[0]?.definition;
      if (d) defs.push(`${m.partOfSpeech ?? ""} ${d}`);
    });
    return {
      phoneticUs,
      audioUsUrl,
      definitionEn: defs.slice(0, 5).join("; ") || undefined,
    };
  } catch {
    return {};
  }
}

export async function enrichWord(word: string): Promise<DictEntry> {
  const youdao = await fetchYoudao(word);
  const fallback = await fetchDictionaryApi(word);
  return {
    word,
    phoneticUk: youdao.phoneticUk,
    phoneticUs: youdao.phoneticUs ?? fallback.phoneticUs,
    audioUkUrl: youdao.audioUkUrl,
    audioUsUrl: youdao.audioUsUrl ?? fallback.audioUsUrl,
    pos: youdao.pos,
    definitionCn: youdao.definitionCn,
    definitionEn: fallback.definitionEn,
    examples: youdao.examples,
    difficulty: 3,
  };
}
