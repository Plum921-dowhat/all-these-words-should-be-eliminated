// 规则型词形还原（lemmatization）：处理英语常见屈折变化（第三人称单数、
// 复数、过去式/分词、进行时），并覆盖一批高频不规则词。
// 这是查词 / 标注 / 导入三处共享的单一可信源，保证同一词的不同形态
// 都能还原到词库里的 headword，解决 spreads→spread 等匹配失败问题。

const IRREGULAR: Record<string, string> = {
  // be
  is: "be", are: "be", was: "be", were: "be", been: "be", being: "be", am: "be",
  // have
  has: "have", had: "have", having: "have",
  // do
  does: "do", did: "do", done: "do",
  // go
  goes: "go", went: "go", gone: "go", going: "go",
  // 其他高频不规则
  better: "good", best: "good",
  worse: "bad", worst: "bad",
  children: "child",
  men: "man", women: "woman",
  feet: "foot", teeth: "tooth",
  mice: "mouse", geese: "goose",
  selves: "self",
  analyses: "analysis", analysis: "analysis",
  indices: "index", indexes: "index",
  formulae: "formula", formulas: "formula",
  crises: "crisis", theses: "thesis",
  people: "person",
  thought: "think", bought: "buy", brought: "bring",
  caught: "catch", taught: "teach", sought: "seek",
  made: "make", came: "come", took: "take", gave: "give",
  spoke: "speak", broke: "break", chose: "choose",
  drove: "drive", wrote: "write", rode: "ride",
  ate: "eat", forbade: "forbid", saw: "see", flew: "fly",
  knew: "know", grew: "grow", threw: "throw", drew: "draw",
  lay: "lie", awoken: "awake", awoke: "awake",
  begun: "begin", begun: "begin", drunk: "drink",
  sung: "sing", rung: "ring", sunk: "sink", swum: "swim",
  worn: "wear", torn: "tear", borne: "bear",
  built: "build", felt: "feel", kept: "keep", left: "leave",
  meant: "mean", met: "meet", sent: "send", spent: "spend",
  lost: "lose", found: "find", held: "hold", told: "tell",
  sold: "sell", paid: "pay", said: "say", heard: "hear",
  read: "read", led: "lead", fed: "feed",
  fallen: "fall", gotten: "get", got: "get", forgotten: "forget",
  sat: "sit", set: "set", shut: "shut", put: "put", cut: "cut",
  hit: "hit", let: "let", spread: "spread", cost: "cost",
  burst: "burst", thrust: "thrust", cast: "cast",
};

// 去符号并转小写（保留连字符与撇号，与现有 normWord 行为一致）。
export function cleanToken(w: string): string {
  return w.trim().toLowerCase().replace(/[^a-z'-]/g, "");
}

export function lemmatize(w: string): string {
  const word = cleanToken(w);
  if (!word) return word;
  if (IRREGULAR[word]) return IRREGULAR[word];

  // 规则还原（按"更安全"的顺序，避免误伤，如先处理 ies/ss 等）。
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("sses") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("ches") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("shes") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("xes") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("zes") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("es") && word.length > 3 && !word.endsWith("ss")) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3 && !word.endsWith("ss")) return word.slice(0, -1);

  if (word.endsWith("ied") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("ed") && word.length > 4) {
    const stem = word.slice(0, -2);
    // 还原出合法动词原形（避免把 speed→spe 这类误伤，简单兜底：保留 ed 剥离）
    if (stem.length > 2) return stem;
  }
  if (word.endsWith("ing") && word.length > 5) {
    const stem = word.slice(0, -3);
    if (stem.endsWith("y") || stem.length > 3) return stem;
  }

  return word;
}
