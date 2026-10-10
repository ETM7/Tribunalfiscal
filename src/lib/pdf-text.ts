import { spawn } from "node:child_process";
import { readFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import {
  extractResumen,
  headerSpan,
  inkBands,
  lineInside,
  linesFromTsv,
  reflowLines,
  signatureSpan,
  tableSpans,
  type OcrLine,
  type VerticalSpan,
} from "@/lib/pdf-layout";

const MAX_PAGES = 20;

export type PdfBlock =
  | { type: "p"; text: string }
  | { type: "table"; image: string; text: string };

export type PdfPage = {
  page: number;
  text: string;
  headerImage: string | null;
  blocks: PdfBlock[];
};

export type CriterionHit = {
  label: string;
  pages: number[];
};

export type TranscriptInput = {
  id: string;
  pdfUrl: string;
  sumillaUrl: string | null;
  pages: PdfPage[];
  hits: CriterionHit[];
  terms: string[];
  truncated: boolean;
  signatureImage: string | null;
  resumen: string;
};

export type TextPiece = {
  text: string;
  hit: boolean;
};

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

/** Palabras del criterio, sin tildes y sin las de una o dos letras (no, de, la). */
export function searchTerms(criteria: { exacta: string; todas: string; cerca: string }): string[] {
  const words = [criteria.exacta, criteria.todas, criteria.cerca]
    .flatMap((value) => foldForSearch(value).split(" "))
    .filter((word) => word.length > 2);
  return [...new Set(words)];
}

export function splitHighlighted(text: string, terms: string[]): TextPiece[] {
  if (!text) return [];
  const wanted = new Set(terms.filter((term) => term.length > 2));
  if (wanted.size === 0) return [{ text, hit: false }];
  const pieces: TextPiece[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    const word = match[0];
    if (start > last) pieces.push({ text: text.slice(last, start), hit: false });
    const folded = foldForSearch(word);
    pieces.push({ text: word, hit: folded.length > 2 && wanted.has(folded) });
    last = start + word.length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), hit: false });
  return pieces.length > 0 ? pieces : [{ text, hit: false }];
}

export function locateCriteria(
  pages: PdfPage[],
  criteria: { exacta: string; todas: string; cerca: string }
): CriterionHit[] {
  const hits: CriterionHit[] = [];
  const exacta = criteria.exacta.trim();
  if (exacta) {
    hits.push({
      label: `Frase «${exacta}»`,
      pages: pages.filter((page) => pageHasPhrase(page.text, exacta)).map((page) => page.page),
    });
  }
  const todas = criteria.todas.trim();
  if (todas) {
    hits.push({
      label: `Palabras «${todas}»`,
      pages: pagesWithEveryWord(pages, todas),
    });
  }
  const cerca = criteria.cerca.trim();
  if (cerca) {
    hits.push({
      label: `Palabras cercanas «${cerca}»`,
      pages: pagesWithEveryWord(pages, cerca),
    });
  }
  return hits;
}

export function buildPdfTranscript(input: TranscriptInput): string {
  const lines = [
    `Resolución ${input.id}`,
    "La sumilla de la lista es el resumen que el MEF publica en una página aparte. No es un extracto de este PDF y no corresponde a un número de página.",
    input.sumillaUrl ? `Sumilla oficial: ${input.sumillaUrl}` : "Sumilla oficial: no disponible.",
    `PDF de origen: ${input.pdfUrl}`,
    "El PDF del MEF está escaneado. El texto de abajo se leyó de esas imágenes para poder usar Control+F y volver a la misma página del archivo de origen.",
    "",
    "Dónde aparece el criterio:",
  ];
  if (input.hits.length === 0) {
    lines.push("- No había frase ni palabras para marcar.");
  } else {
    for (const hit of input.hits) {
      lines.push(`- ${hit.label}: ${hit.pages.length ? `páginas ${formatPages(hit.pages)}` : "no aparece"}.`);
    }
  }
  if (input.truncated) {
    lines.push(`Solo se leyeron las primeras ${MAX_PAGES} páginas.`);
  }
  lines.push("");
  for (const page of input.pages) {
    lines.push(`----- Página ${page.page} -----`);
    lines.push(page.text.trim());
    lines.push("");
  }
  return lines.join("\n");
}

export function buildEditableHtml(input: TranscriptInput): string {
  const marked = new Set(input.hits.flatMap((hit) => hit.pages));
  const criterion =
    input.hits.length === 0
      ? "<li>No había frase ni palabras para marcar.</li>"
      : input.hits
          .map(
            (hit) =>
              `<li>${escapeHtml(hit.label)}: ${hit.pages.length ? `páginas ${escapeHtml(formatPages(hit.pages))}` : "no aparece"}.</li>`
          )
          .join("");
  const pages = input.pages
    .map((page) => {
      const note = marked.has(page.page) ? " — aquí aparece el criterio" : "";
      const header = page.headerImage
        ? `<img alt="Encabezado de la página ${page.page}" src="${page.headerImage}">`
        : "";
      const body = page.blocks
        .map((block) =>
          block.type === "table"
            ? `<figure><img alt="Tabla de la página ${page.page}" src="${block.image}"><details><summary>Texto de esta tabla para Buscar</summary><p>${highlightHtml(block.text, input.terms)}</p></details></figure>`
            : `<p>${highlightHtml(block.text, input.terms)}</p>`
        )
        .join("\n");
      return `<section><h2>Página ${page.page}${escapeHtml(note)}</h2>${header}${body}</section>`;
    })
    .join("\n");
  const firmas = input.signatureImage
    ? `<figure><img alt="Firmas del final del PDF" src="${input.signatureImage}"></figure>`
    : "";
  const sumilla = input.sumillaUrl
    ? `<a href="${escapeHtml(input.sumillaUrl)}">Sumilla oficial</a>`
    : "Sumilla oficial no disponible";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Resolución ${escapeHtml(input.id)} — texto editable</title>
<style>
  body { font-family: Georgia, "Source Serif 4", serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem 3rem; line-height: 1.55; color: #1c1915; }
  .bar { position: sticky; top: 0; background: #fffdf8; padding: 0.8rem 0; border-bottom: 1px solid #e2d9cb; }
  button, summary.boton { font: inherit; border: 1px solid #1c1915; border-radius: 999px; padding: 0.55rem 0.9rem; background: white; cursor: pointer; display: inline-block; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.15rem; margin-top: 2rem; }
  p { text-align: justify; }
  img { display: block; margin: 1rem auto; max-width: 100%; }
  a { color: #8c2f2f; }
  mark { background: #ffe566; color: inherit; padding: 0 0.08em; border-radius: 0.12em; }
</style>
</head>
<body>
<div class="bar">
  <strong>Resolución ${escapeHtml(input.id)}</strong>
  <p>Usa Control+F o Buscar. El texto se puede editar. La descarga guarda este archivo.</p>
  <button type="button" id="descargar">Descargar archivo editable</button>
  <a href="${escapeHtml(input.pdfUrl)}">PDF de origen en el MEF</a>
</div>
<p>${sumilla}. La sumilla no es una página de este PDF.</p>
<details>
  <summary class="boton">Resumen del PDF</summary>
  <p>${highlightHtml(input.resumen, input.terms)}</p>
</details>
<ul>${criterion}</ul>
${input.truncated ? `<p>Solo se leyeron las primeras ${MAX_PAGES} páginas.</p>` : ""}
<article id="texto" contenteditable="true">
${pages}
${firmas}
</article>
<script>
document.getElementById("descargar").addEventListener("click", function () {
  var html = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
  var blob = new Blob([html], { type: "text/html;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = ${JSON.stringify(`${input.id}-editable.html`)};
  link.click();
  URL.revokeObjectURL(url);
});
</script>
</body>
</html>`;
}

function highlightHtml(text: string, terms: string[]): string {
  return splitHighlighted(text, terms)
    .map((piece) => (piece.hit ? `<mark>${escapeHtml(piece.text)}</mark>` : escapeHtml(piece.text)))
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function pagesFromTextLayer(text: string): PdfPage[] {
  const parts = text.split("\f");
  while (parts.length > 0 && parts[parts.length - 1].trim() === "") parts.pop();
  return parts.map((part, index) => {
    const text = part.trim();
    const blocks = reflowLines(text.split(/\n/)).map((paragraph) => ({ type: "p" as const, text: paragraph }));
    return { page: index + 1, text, headerImage: null, blocks };
  });
}

export function textLayerIsUsable(text: string): boolean {
  return (text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length >= 80;
}

export async function readPdfPages(
  bytes: Uint8Array
): Promise<{ pages: PdfPage[]; truncated: boolean; signatureImage: string | null; resumen: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), "rtf-"));
  try {
    const pdfPath = path.join(dir, "doc.pdf");
    await writeFile(pdfPath, bytes);
    const extracted = await run("pdftotext", ["-enc", "UTF-8", "-layout", pdfPath, "-"], 20_000);
    if (extracted.code === 0 && textLayerIsUsable(extracted.stdout.toString("utf8"))) {
      const text = extracted.stdout.toString("utf8");
      const pages = pagesFromTextLayer(text).slice(0, MAX_PAGES);
      return { pages, truncated: false, signatureImage: null, resumen: extractResumen(text) };
    }
    const rendered = await run("pdftoppm", ["-png", "-r", "150", "-l", String(MAX_PAGES), pdfPath, path.join(dir, "p")], 40_000);
    if (rendered.code !== 0) {
      throw new Error(rendered.stderr.toString("utf8") || "pdftoppm");
    }
    const images = (await readdir(dir))
      .filter((name) => /^p-\d+\.png$/.test(name))
      .sort((a, b) => pageNumber(a) - pageNumber(b));
    let truncated = false;
    if (images.length >= MAX_PAGES) {
      const info = await run("pdfinfo", [pdfPath], 10_000);
      const total = Number(info.stdout.toString("utf8").match(/^Pages:\s+(\d+)/m)?.[1] || "0");
      truncated = total > images.length;
    }
    const pages: PdfPage[] = [];
    let signatureImage: string | null = null;
    const fullText: string[] = [];
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const file = path.join(dir, image);
      const ocr = await run("tesseract", [file, "stdout", "-l", "spa", "--psm", "6", "tsv"], 45_000);
      if (ocr.code !== 0) throw new Error(ocr.stderr.toString("utf8") || "tesseract");
      const laidOut = layoutPage(PNG.sync.read(await readFile(file)), linesFromTsv(ocr.stdout.toString("utf8")), {
        signature: !truncated && index === images.length - 1,
      });
      if (laidOut.signatureImage) signatureImage = laidOut.signatureImage;
      fullText.push(laidOut.fullText);
      pages.push({
        page: pageNumber(image),
        text: laidOut.text,
        headerImage: laidOut.headerImage,
        blocks: laidOut.blocks,
      });
    }
    return { pages, truncated, signatureImage, resumen: extractResumen(fullText.join("\n")) };
  } catch (error) {
    if (isMissingTool(error)) {
      throw new Error("En este servidor no está el lector de páginas escaneadas.");
    }
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function layoutPage(png: PNG, lines: OcrLine[], options: { signature: boolean }) {
  const ink: number[] = [];
  for (let y = 0; y < png.height; y += 1) {
    let dark = 0;
    let samples = 0;
    for (let x = 0; x < png.width; x += 2) {
      samples += 1;
      if (png.data[(png.width * y + x) << 2] < 180) dark += 1;
    }
    ink.push(samples === 0 ? 0 : dark / samples);
  }
  const bands = inkBands(ink);
  const rules = horizontalRules(png);
  const header = headerSpan(bands, png.height);
  const tables = tableSpans(rules).filter((span) => !header || span.top > header.bottom);
  const signature = options.signature ? signatureSpan(bands, png.height) : null;
  const hidden = [header, signature, ...tables].filter((span): span is VerticalSpan => Boolean(span));
  const visible = lines.filter((line) => !hidden.some((span) => lineInside(line, span)));
  const tableLines = tables.map((span) => ({
    span,
    text: lines
      .filter((line) => lineInside(line, span))
      .map((line) => line.text)
      .join(" "),
  }));
  const blocks: PdfBlock[] = [];
  const buffer: string[] = [];
  const flush = () => {
    for (const paragraph of reflowLines(buffer)) blocks.push({ type: "p", text: paragraph });
    buffer.length = 0;
  };
  const events: Array<{ y: number; kind: "line"; text: string } | { y: number; kind: "table"; index: number }> = [
    ...visible.map((line) => ({ y: line.top, kind: "line" as const, text: line.text })),
    ...tableLines.map((table, index) => ({ y: table.span.top, kind: "table" as const, index })),
  ];
  events.sort((a, b) => a.y - b.y);
  for (const event of events) {
    if (event.kind === "line") buffer.push(event.text);
    else {
      flush();
      blocks.push({
        type: "table",
        image: cropPng(png, tableLines[event.index].span),
        text: tableLines[event.index].text,
      });
    }
  }
  flush();
  const searchText = [
    ...blocks.filter((block) => block.type === "p").map((block) => block.text),
    ...tableLines.map((table) => table.text),
  ].join("\n");
  return {
    headerImage: header ? cropPng(png, header) : null,
    signatureImage: signature ? cropPng(png, signature) : null,
    blocks,
    text: searchText,
    fullText: lines.map((line) => line.text).join("\n"),
  };
}

function horizontalRules(png: PNG): number[] {
  const minRun = png.width * 0.35;
  const rules: number[] = [];
  for (let y = 0; y < png.height; y += 1) {
    let run = 0;
    let best = 0;
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(png.width * y + x) << 2] < 180) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    if (best >= minRun) rules.push(y);
  }
  return rules;
}

function cropPng(png: PNG, span: VerticalSpan): string {
  const top = Math.max(0, Math.min(png.height - 1, Math.floor(span.top)));
  const bottom = Math.max(top + 1, Math.min(png.height, Math.ceil(span.bottom)));
  const height = bottom - top;
  const out = new PNG({ width: png.width, height });
  PNG.bitblt(png, out, 0, top, png.width, height, 0, 0);
  return `data:image/png;base64,${PNG.sync.write(out).toString("base64")}`;
}

function pagesWithEveryWord(pages: PdfPage[], value: string): number[] {
  const words = foldForSearch(value).split(" ").filter((word) => word.length > 2);
  if (words.length === 0) return [];
  return pages
    .filter((page) => {
      const text = foldForSearch(page.text);
      return words.every((word) => text.includes(word));
    })
    .map((page) => page.page);
}

function pageHasPhrase(text: string, phrase: string): boolean {
  const folded = foldForSearch(text);
  const target = foldForSearch(phrase);
  if (!target) return false;
  if (folded.includes(target)) return true;
  const words = target.split(" ").filter(Boolean);
  if (words.length < 2) return false;
  const pattern = words.map(escapeRegExp).join("(?:\\s+\\w+){0,2}\\s+");
  return new RegExp(pattern).test(folded);
}

function formatPages(pages: number[]): string {
  return pages.join(", ");
}

function pageNumber(filename: string): number {
  return Number(filename.match(/(\d+)\.png$/)?.[1] || "0");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isMissingTool(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function run(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ code: number; stdout: Buffer; stderr: Buffer }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
    };
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      finish();
      reject(error);
    });
    child.on("close", (code, signal) => {
      finish();
      if (signal === "SIGKILL") {
        reject(new Error("La lectura de una página tardó demasiado."));
        return;
      }
      resolve({ code: code ?? 1, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });
}
