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

const MONTHS: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  setiembre: "09",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

const WORD_DATE =
  /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+de(?:l)?\s+(\d{4})/gi;
const SLASH_DATE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;

/** Sala del identificador: 2017_1_04481 → Sala 1, 2025_Q_04131 → Sala Q. */
export function salaFromId(id: string): string | null {
  const match = id.trim().replace(/^\//, "").match(/^\d{4}_([A-Za-z0-9]+)_\d+$/);
  return match ? `Sala ${match[1]}` : null;
}

/**
 * Fecha de la resolución, junto a la palabra «fecha» del encabezado.
 * No usa otras fechas del texto, como las del visto.
 */
export function parseResolutionDate(text: string): string | null {
  const { folded, toOriginal } = foldWithMap(text);
  const needle = "fecha";
  let from = 0;
  while (from <= folded.length - needle.length) {
    const at = folded.indexOf(needle, from);
    if (at < 0) break;
    const before = at === 0 || folded[at - 1] === " ";
    const afterAt = at + needle.length;
    const after = afterAt >= folded.length || folded[afterAt] === " ";
    if (before && after) {
      const start = toOriginal[at] ?? 0;
      const found = dateInWindow(text.slice(start, start + 100));
      if (found) return found;
    }
    from = at + Math.max(needle.length, 1);
  }
  return null;
}

function dateInWindow(window: string): string | null {
  const found: { index: number; value: string }[] = [];
  for (const match of window.matchAll(WORD_DATE)) {
    const month = MONTHS[match[2].toLowerCase()];
    const value = month ? formatDate(Number(match[1]), Number(month), Number(match[3])) : null;
    if (value) found.push({ index: match.index ?? 0, value });
  }
  for (const match of window.matchAll(SLASH_DATE)) {
    const value = formatDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (value) found.push({ index: match.index ?? 0, value });
  }
  found.sort((left, right) => left.index - right.index);
  return found[0]?.value ?? null;
}

function formatDate(day: number, month: number, year: number): string | null {
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
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
