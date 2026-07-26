// Sample seed data. In production, replace `raw/` lists with full open-source
// word lists and run them through enrich.ts (free dictionary API).
import type { ExamType } from "../../src/lib/enums";

export interface SeedWord {
  headword: string;
  phoneticUs?: string;
  definitionCn?: string;
  pos?: string; // JSON: [{pos, def}]
  examples?: string; // JSON: [{en, zh}]
  difficulty?: number;
  exams: ExamType[];
}

export const CET4: SeedWord[] = [
  { headword: "abandon", phoneticUs: "/əˈbændən/", definitionCn: "v. 放弃；抛弃", pos: JSON.stringify([{ pos: "v.", def: "放弃；抛弃" }]), difficulty: 2, exams: ["CET4", "COMMON"] },
  { headword: "ability", phoneticUs: "/əˈbɪləti/", definitionCn: "n. 能力；才能", pos: JSON.stringify([{ pos: "n.", def: "能力；才能" }]), difficulty: 1, exams: ["CET4", "COMMON"] },
  { headword: "academic", phoneticUs: "/ˌækəˈdemɪk/", definitionCn: "adj. 学术的；学院的", pos: JSON.stringify([{ pos: "adj.", def: "学术的；学院的" }]), difficulty: 2, exams: ["CET4", "CET6", "COMMON"] },
  { headword: "benefit", phoneticUs: "/ˈbenɪfɪt/", definitionCn: "n. 利益；好处 v. 有益于", pos: JSON.stringify([{ pos: "n.", def: "利益；好处" }, { pos: "v.", def: "有益于" }]), difficulty: 1, exams: ["CET4", "CET6", "KY", "COMMON"] },
  { headword: "challenge", phoneticUs: "/ˈtʃælɪndʒ/", definitionCn: "n./v. 挑战", pos: JSON.stringify([{ pos: "n.", def: "挑战" }, { pos: "v.", def: "向…挑战" }]), difficulty: 1, exams: ["CET4", "CET6", "COMMON"] },
  { headword: "community", phoneticUs: "/kəˈmjuːnəti/", definitionCn: "n. 社区；团体", pos: JSON.stringify([{ pos: "n.", def: "社区；团体" }]), difficulty: 1, exams: ["CET4", "CET6", "COMMON"] },
  { headword: "environment", phoneticUs: "/ɪnˈvaɪrənmənt/", definitionCn: "n. 环境", pos: JSON.stringify([{ pos: "n.", def: "环境" }]), difficulty: 1, exams: ["CET4", "CET6", "KY", "COMMON"] },
  { headword: "government", phoneticUs: "/ˈɡʌvərnmənt/", definitionCn: "n. 政府", pos: JSON.stringify([{ pos: "n.", def: "政府" }]), difficulty: 1, exams: ["CET4", "CET6", "COMMON"] },
  { headword: "improve", phoneticUs: "/ɪmˈpruːv/", definitionCn: "v. 改善；提高", pos: JSON.stringify([{ pos: "v.", def: "改善；提高" }]), difficulty: 1, exams: ["CET4", "CET6", "COMMON"] },
  { headword: "knowledge", phoneticUs: "/ˈnɒlɪdʒ/", definitionCn: "n. 知识；学问", pos: JSON.stringify([{ pos: "n.", def: "知识；学问" }]), difficulty: 1, exams: ["CET4", "CET6", "KY", "COMMON"] },
];

export const CET6: SeedWord[] = [
  { headword: "abolish", phoneticUs: "/əˈbɒlɪʃ/", definitionCn: "v. 废除；废止", pos: JSON.stringify([{ pos: "v.", def: "废除；废止" }]), difficulty: 3, exams: ["CET6"] },
  { headword: "ambiguous", phoneticUs: "/æmˈbɪɡjuəs/", definitionCn: "adj. 模棱两可的", pos: JSON.stringify([{ pos: "adj.", def: "模棱两可的" }]), difficulty: 3, exams: ["CET6"] },
  { headword: "comprehensive", phoneticUs: "/ˌkɒmprɪˈhensɪv/", definitionCn: "adj. 综合的；全面的", pos: JSON.stringify([{ pos: "adj.", def: "综合的；全面的" }]), difficulty: 3, exams: ["CET6", "KY"] },
  { headword: "deliberate", phoneticUs: "/dɪˈlɪbərət/", definitionCn: "adj. 故意的；深思熟虑的", pos: JSON.stringify([{ pos: "adj.", def: "故意的；深思熟虑的" }]), difficulty: 4, exams: ["CET6"] },
  { headword: "phenomenon", phoneticUs: "/fəˈnɒmɪnən/", definitionCn: "n. 现象", pos: JSON.stringify([{ pos: "n.", def: "现象" }]), difficulty: 3, exams: ["CET6", "KY"] },
  { headword: "sufficient", phoneticUs: "/səˈfɪʃnt/", definitionCn: "adj. 足够的；充分的", pos: JSON.stringify([{ pos: "adj.", def: "足够的；充分的" }]), difficulty: 3, exams: ["CET6", "KY"] },
];

export const KY: SeedWord[] = [
  { headword: "address", phoneticUs: "/əˈdres/", definitionCn: "v. 处理；演说 n. 地址", pos: JSON.stringify([{ pos: "v.", def: "处理；演说" }, { pos: "n.", def: "地址" }]), difficulty: 2, exams: ["KY", "CET6"] },
  { headword: "advocate", phoneticUs: "/ˈædvəkeɪt/", definitionCn: "v. 提倡；拥护 n. 拥护者", pos: JSON.stringify([{ pos: "v.", def: "提倡；拥护" }, { pos: "n.", def: "拥护者" }]), difficulty: 3, exams: ["KY", "CET6"] },
  { headword: "consequence", phoneticUs: "/ˈkɒnsɪkwəns/", definitionCn: "n. 结果；后果", pos: JSON.stringify([{ pos: "n.", def: "结果；后果" }]), difficulty: 2, exams: ["KY", "CET6", "CET4"] },
  { headword: "demonstrate", phoneticUs: "/ˈdemənstreɪt/", definitionCn: "v. 证明；展示", pos: JSON.stringify([{ pos: "v.", def: "证明；展示" }]), difficulty: 3, exams: ["KY", "CET6"] },
  { headword: "inevitable", phoneticUs: "/ɪnˈevɪtəbl/", definitionCn: "adj. 不可避免的", pos: JSON.stringify([{ pos: "adj.", def: "不可避免的" }]), difficulty: 3, exams: ["KY", "CET6"] },
];

export const ARTICLES = [
  {
    title: "The Power of Community",
    level: "CET4" as ExamType,
    cefr: 2,
    source: "LexiLearn Sample",
    content:
      "A community is more than a group of people. When people share a common goal, they can improve their environment together.\n\nFor example, a small town decided to abandon single-use plastic. The government supported the challenge, and citizens benefited from cleaner streets. This academic study shows that knowledge spreads faster inside a strong community.\n\nThe benefit of working together is clear: everyone has the ability to make a difference.",
  },
  {
    title: "Climate Change: A Global Phenomenon",
    level: "CET6" as ExamType,
    cefr: 3,
    source: "LexiLearn Sample",
    content:
      "Climate change is a comprehensive challenge that no single government can address alone.\n\nScientists demonstrate that rising temperatures are an inevitable consequence of human activity. Some leaders advocate for sufficient action, while others remain ambiguous about the deliberate choices we must make.\n\nTo abolish harmful policies, we need a global community with shared knowledge.",
  },
];
