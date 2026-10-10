export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type TextSpan = { start: number; end: number };

/** Cada carácter plegado apunta al índice original donde empieza. */
export function foldWithMap(value: string): { folded: string; toOriginal: number[] } {
  let folded = "";
  const toOriginal: number[] = [];
  let pendingSpace = false;
  let started = false;
  for (let index = 0; index < value.length; ) {
    const code = value.codePointAt(index) ?? 0;
    const char = String.fromCodePoint(code);
    const base = char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const alnum = base.replace(/[^a-z0-9]+/g, "");
    if (alnum) {
      if (pendingSpace && started) {
        folded += " ";
        toOriginal.push(index);
      }
      for (const piece of alnum) {
        folded += piece;
        toOriginal.push(index);
      }
      started = true;
      pendingSpace = false;
    } else if (started) {
      pendingSpace = true;
    }
    index += char.length;
  }
  return { folded, toOriginal };
}

/** Frase dentro del texto, sin distinguir tildes ni mayúsculas. */
export function phraseSpans(text: string, query: string): TextSpan[] {
  const needle = foldForSearch(query);
  if (!needle) return [];
  const { folded, toOriginal } = foldWithMap(text);
  const spans: TextSpan[] = [];
  let from = 0;
  while (from < folded.length) {
    const at = folded.indexOf(needle, from);
    if (at < 0) break;
    const before = at === 0 || folded[at - 1] === " ";
    const afterAt = at + needle.length;
    const after = afterAt === folded.length || folded[afterAt] === " ";
    if (before && after) {
      const start = toOriginal[at] ?? 0;
      const last = toOriginal[afterAt - 1] ?? start;
      const width = String.fromCodePoint(text.codePointAt(last) ?? 0).length || 1;
      spans.push({ start, end: last + width });
    }
    from = at + Math.max(needle.length, 1);
  }
  return spans;
}
