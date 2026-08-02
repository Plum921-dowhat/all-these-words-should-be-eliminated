/**
 * parseWired.ts —— 从 calibre 导出的纯文本（WIRED 等英文长文）精确切分：
 *   作者 / 栏目 / 日期 / 标题 / 导语(dek) / 正文
 * 输出可直喂现有导入 API（src/app/api/articles/route.ts）的 JSON 数组，
 * 字段：{ title, dek, level, cefr, content, source }。
 *
 * 用法（零运行时依赖，用 tsx 直接跑）：
 *   npx tsx scripts/parseWired.ts input.txt            # 输出到 stdout
 *   npx tsx scripts/parseWired.ts input.txt out.json   # 写出到文件
 *
 * 说明：当前按通用规则实现。拿到真实 calibre 文件后可在此微调 DROP 关键词与正则。
 */
import { readFileSync, writeFileSync } from "node:fs";

const MAX_DEK_LEN = 160;
const MAX_DEK_LINES = 4;

// 需跳过的杂质行（广告 / 版权 / 导航 / 图注等）
const DROP_PATTERNS = [
  /advertisement/i,
  /©/,
  /all rights reserved/i,
  /subscribe/i,
  /photograph by/i,
  /^\s*(credits?|illustration by)\b/i,
  /^by (wired|the author)\b/i,
];

// 日期行识别：如 "March 12, 2024" / "12 March 2024" / 含 WIRED 的刊头
const DATE_RE =
  /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i;
const MASTHEAD_RE = /\bwired\b/i;

function isDrop(line: string): boolean {
  return DROP_PATTERNS.some((p) => p.test(line));
}

function parse(raw: string): { title: string; dek: string | null; content: string; source: string } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());

  // 找到正文起点：第一个日期行或 WIRED 刊头之后
  let startIdx = lines.findIndex((l) => DATE_RE.test(l) || MASTHEAD_RE.test(l));
  if (startIdx === -1) startIdx = 0;
  else startIdx += 1; // 从日期/刊头下一行开始

  const bodyLines: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (isDrop(l)) continue;
    if (DATE_RE.test(l) || MASTHEAD_RE.test(l)) continue; // 跳过日期/刊头标记行
    bodyLines.push(l);
  }

  if (bodyLines.length === 0) {
    return { title: "(unnamed)", dek: null, content: "", source: "WIRED" };
  }

  // 第一个非空短行为标题
  const title = bodyLines.shift() as string;

  // 紧接着若后续若干行较短（≤160 字符累计 ≤4 行）且不像正文长段落 → 作为 dek
  const dekParts: string[] = [];
  let acc = 0;
  while (
    bodyLines.length > 0 &&
    dekParts.length < MAX_DEK_LINES &&
    bodyLines[0].length <= MAX_DEK_LEN &&
    (acc += bodyLines[0].length) <= MAX_DEK_LEN
  ) {
    dekParts.push(bodyLines.shift() as string);
  }
  const dek = dekParts.length ? dekParts.join(" ").slice(0, MAX_DEK_LEN).trim() : null;

  // 剩余为正文：软换行（相邻非空行）合并为空格，空行作为分段信号
  const paragraphs: string[] = [];
  let buf = "";
  for (const l of bodyLines) {
    if (!l) {
      if (buf) paragraphs.push(buf);
      buf = "";
    } else {
      buf = buf ? `${buf} ${l}` : l;
    }
  }
  if (buf) paragraphs.push(buf);
  const content = paragraphs.join("\n\n").trim();

  return { title, dek, content, source: "WIRED" };
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath) {
    console.error("用法: npx tsx scripts/parseWired.ts <input.txt> [out.json]");
    process.exit(1);
  }
  const raw = readFileSync(inPath, "utf8");
  const { title, dek, content, source } = parse(raw);
  const article = {
    title,
    dek,
    level: "COMMON",
    cefr: 1,
    content,
    source,
  };
  const json = JSON.stringify([article], null, 2);
  if (outPath) {
    writeFileSync(outPath, json, "utf8");
    console.log(`已写出 ${outPath}（标题：${title}${dek ? `，dek：${dek.slice(0, 40)}…` : ""}）`);
  } else {
    console.log(json);
  }
}

main();
