# 导入功能 JSON 格式说明

三个导入入口（导入词库、添加单词、导入阅读）现在都支持 **JSON 格式**，同时保留原有的「纯文本行」格式。后端会自动识别：内容以 `{` 或 `[` 开头时按 JSON 解析，否则回退到文本行解析。文件上传控件已接受 `.json` 文本文件。

通用约定：

- 单词条目（`WordEntry`）可为以下任意一种形态，会被归一化后写入词库（`Word` 表）：
  - **对象**：`{ "headword": "apple", "definitionCn": "苹果", ... }`
  - **二元数组**：`["apple", "苹果"]`（第一项为单词，第二项为中文释义）
  - **字符串**：`"apple | 苹果"` 或 `"apple 苹果"`（以 `|`、`，`、`,`、Tab 或空白分隔）
- 字段名做了宽松映射（兼容多种命名习惯），见下表。
- `pos` / `examples` 若传入对象或数组，会自动 `JSON.stringify` 后以字符串存入；若传入字符串则原样保存。

## 一、导入词库 `POST /api/word-library`

请求体字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 词库名称（必填；JSON 内也可含 `title`） |
| `level` | string | 难度，取值见「难度取值表」；缺省 `COMMON` |
| `desc` | string | 简介（可选；JSON 内也可含 `desc`） |
| `content` | string | 单词清单，可为文本行或 JSON |

`content` 为 JSON 时的两种形态：

```json
{
  "title": "考研核心词",
  "level": "KY",
  "desc": "高频核心词汇",
  "words": [
    { "headword": "abandon", "definitionCn": "放弃", "phoneticUs": "/əˈbændən/", "pos": "v." },
    "book | 书",
    ["apple", "苹果"]
  ]
}
```

也支持直接传一个单词数组（此时 `title` 仍需在请求体中提供）：

```json
[
  { "headword": "apple", "definitionCn": "苹果" },
  { "headword": "book", "definitionCn": "书" }
]
```

## 二、添加单词 `POST /api/words/add`

支持单条、数组、`{ words: [...] }` 三种形态，全部加入当前用户生词本（状态 `NEW`）。返回 `{ ok, added, total }`。

```json
[
  { "headword": "apple", "definitionCn": "苹果", "phoneticUs": "/ˈæp.əl/", "examples": "I eat an apple." },
  { "headword": "book", "definitionCn": "书" }
]
```

或：

```json
{ "words": [ { "headword": "apple", "definitionCn": "苹果" } ] }
```

或单条对象（与原表单等价）：

```json
{ "headword": "apple", "definitionCn": "苹果", "phoneticUs": "/ˈæp.əl/" }
```

> 在「我的生词本」页面，原单条表单保留，并新增了独立的「批量 JSON 导入」分区（粘贴或上传 `.json`/`.txt`）。

## 三、导入阅读 `POST /api/articles`

支持 JSON 单篇或数组，每篇正文可为字符串或段落数组（自动用空行连接）。返回 `{ ok, count, articleId }`。

```json
{
  "title": "The Little Prince",
  "level": "CET4",
  "cefr": 2,
  "source": "自导入",
  "content": "Once upon a time...\n\nThe second paragraph..."
}
```

多篇文章：

```json
[
  { "title": "A", "level": "CET4", "cefr": 1, "content": ["para1", "para2"] },
  { "title": "B", "level": "CET6", "cefr": 3, "content": "full text..." }
]
```

字段映射：标题 `title`/`name`/`heading`；正文 `content`/`body`/`text`，或段落数组 `content`/`paragraphs`/`body`；难度 `level`；CEFR 等级 `cefr`/`level_num`（1–5）；来源 `source`。每篇文章自身字段优先，表单字段作为兜底。

## 单词条目字段映射表（WordEntry）

| 含义 | 接受的键名 |
|------|-----------|
| 单词（必填） | `headword` / `word` / `term` / `name` / `spelling` / `text` |
| 中文释义 | `definitionCn` / `def` / `meaning` / `cn` / `definition` / `trans` / `translation` |
| 英文释义 | `definitionEn` / `en` / `defEn` |
| 英式音标 | `phoneticUk` / `uk` / `phonetic_uk` |
| 美式音标 | `phoneticUs` / `us` / `phonetic_us` |
| 词性 | `pos`（字符串或 `[{ "pos": "n.", "def": "..." }]`） |
| 例句 | `examples`（字符串或 `[{ "en": "...", "zh": "..." }]`） |

## 难度取值表（ExamType）

`COMMON`(通用)、`CET4`(四级)、`CET6`(六级)、`KY`(考研)、`TEM4`(专四)、`TEM8`(专八)、`IELTS`(雅思)、`TOEFL`(托福)

## 注意

- 单词去重：同一导入内重复单词只记一次；写入 `Word` 表时不会用空值覆盖已有释义/音标/例句。
- 阅读正文为 JSON 数组时，各段落用两个换行符（`\n\n`）连接成一篇。
- 所有导入接口均需登录（依赖会话），未登录返回 401。
