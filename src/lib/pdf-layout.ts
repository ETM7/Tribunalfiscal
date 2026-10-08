export type InkBand = {
  top: number;
  bottom: number;
  height: number;
};

export type OcrLine = {
  top: number;
  bottom: number;
  text: string;
};

export type VerticalSpan = {
  top: number;
  bottom: number;
};

export function inkBands(ink: number[], threshold = 0.008): InkBand[] {
  const bands: InkBand[] = [];
  let start = -1;
  for (let y = 0; y < ink.length; y += 1) {
    const marked = ink[y] > threshold;
    if (marked && start < 0) start = y;
    if (!marked && start >= 0) {
      bands.push({ top: start, bottom: y - 1, height: y - start });
      start = -1;
    }
  }
  if (start >= 0) {
    bands.push({ top: start, bottom: ink.length - 1, height: ink.length - start });
  }
  return bands;
}

export function headerSpan(bands: InkBand[], height: number): VerticalSpan | null {
  const limit = height * 0.24;
  const tall = bands.filter((band) => band.height >= 40 && band.top < limit);
  if (tall.length === 0) return null;
  let top = Math.min(...tall.map((band) => band.top));
  for (const band of bands) {
    if (band.bottom < top && top - band.bottom < 40) top = Math.min(top, band.top);
  }
  const bottom = Math.max(...tall.map((band) => band.bottom)) + 14;
  return { top: Math.max(0, top - 10), bottom: Math.min(height, bottom) };
}

export function signatureSpan(bands: InkBand[], height: number): VerticalSpan | null {
  const tall = bands.filter((band) => band.height >= 45 && band.top > height * 0.4 && band.top < height * 0.82);
  if (tall.length === 0) return null;
  const top = Math.min(...tall.map((band) => band.top)) - 10;
  let bottom = Math.max(...tall.map((band) => band.bottom));
  let grew = true;
  while (grew) {
    grew = false;
    for (const band of bands) {
      if (bottom < band.top && band.top <= bottom + 36 && band.height <= 28) {
        bottom = band.bottom;
        grew = true;
      }
    }
  }
  return { top: Math.max(0, top), bottom: Math.min(height, bottom + 12) };
}

export function tableSpans(rules: number[]): VerticalSpan[] {
  const sorted = [...rules].sort((a, b) => a - b);
  if (sorted.length < 3) return [];
  const clusters: number[][] = [];
  let current = [sorted[0]];
  for (const y of sorted.slice(1)) {
    if (y - current[current.length - 1] <= 44) current.push(y);
    else {
      clusters.push(current);
      current = [y];
    }
  }
  clusters.push(current);
  return clusters
    .filter((cluster) => cluster.length >= 4 && cluster[cluster.length - 1] - cluster[0] >= 40)
    .map((cluster) => ({ top: cluster[0] - 6, bottom: cluster[cluster.length - 1] + 6 }));
}

export function linesFromTsv(tsv: string): OcrLine[] {
  const groups = new Map<string, { top: number; bottom: number; words: { left: number; text: string }[] }>();
  for (const row of tsv.split(/\n/)) {
    const cols = row.split("\t");
    if (cols.length < 12 || cols[0] === "level") continue;
    if (Number(cols[5]) === 0) continue;
    const text = cols.slice(11).join("\t").trim();
    if (!text || Number(cols[10]) < 0) continue;
    const key = `${cols[2]}:${cols[3]}:${cols[4]}`;
    const top = Number(cols[7]);
    const bottom = top + Number(cols[9]);
    const group = groups.get(key) ?? { top, bottom, words: [] };
    group.top = Math.min(group.top, top);
    group.bottom = Math.max(group.bottom, bottom);
    group.words.push({ left: Number(cols[6]), text });
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.top - b.top || a.words[0].left - b.words[0].left)
    .map((group) => ({
      top: group.top,
      bottom: group.bottom,
      text: group.words
        .sort((a, b) => a.left - b.left)
        .map((word) => word.text)
        .join(" "),
    }))
    .filter((line) => line.text.trim().length > 0);
}

export function lineInside(line: OcrLine, span: VerticalSpan): boolean {
  const middle = (line.top + line.bottom) / 2;
  return middle >= span.top && middle <= span.bottom;
}

export function reflowLines(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let current = "";
  const flush = () => {
    const value = current.replace(/\s+/g, " ").trim();
    if (value) paragraphs.push(value);
    current = "";
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (isOwnParagraph(line)) {
      flush();
      paragraphs.push(line);
      continue;
    }
    if (!current) {
      current = line;
      continue;
    }
    if (current.endsWith("-") && /^[a-záéíóúñü]/.test(line)) current = `${current.slice(0, -1)}${line}`;
    else current = `${current} ${line}`;
  }
  flush();
  return paragraphs;
}

export function extractResumen(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const resolved = clean.match(/resuelve\s*:?\s*(.{40,900}?)(?=\s*reg[ií]strese\b|$)/i);
  if (resolved) return resolved[1].trim();
  const vista = clean.match(/vista\s+(.{80,500})/i);
  if (vista) return vista[1].trim();
  return clean.slice(0, 500);
}

function isOwnParagraph(line: string): boolean {
  if (/^(vista|considerando|resuelve)\b/i.test(line) && line.length < 40) return true;
  return /^[A-ZÁÉÍÓÚÑÜ0-9 .°ºN*]{4,30}:\s*\S/.test(line) && line.length < 90;
}
