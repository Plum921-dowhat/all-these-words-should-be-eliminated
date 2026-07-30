import { parsePosJson, parseExamplesJson } from "@/lib/format";

// Renders the part-of-speech tags and example sentences for a word.
// Both props are the raw DB strings (JSON or plain text); nothing is shown
// when neither is present.
export function WordFields({
  pos,
  examples,
}: {
  pos?: string | null;
  examples?: string | null;
}) {
  const posList = parsePosJson(pos);
  const exList = parseExamplesJson(examples);
  if (posList.length === 0 && exList.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {posList.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {posList.map((p, i) => (
            <span
              key={i}
              className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
            >
              {[p.pos, p.def].filter(Boolean).join(" ")}
            </span>
          ))}
        </div>
      )}
      {exList.length > 0 && (
        <ul className="space-y-0.5 text-xs leading-relaxed text-slate-400">
          {exList.map((e, i) => (
            <li key={i}>
              {e.en}
              {e.zh ? <span className="text-slate-500"> — {e.zh}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
