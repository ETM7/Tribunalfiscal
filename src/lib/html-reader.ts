import * as cheerio from "cheerio";
import { isExpedienteRef, isOfficialPdfPath, isSumillaValor } from "./search-query";

const PAGE_ROWS = 5;

export type ParsedRow = {
  id: string;
  rawId: string;
  pdfPath: string;
  sumillaValor: string;
};

export type ParsedSearchPage =
  | {
      ok: true;
      total: number;
      from: number;
      to: number;
      results: ParsedRow[];
      extraRows: boolean;
    }
  | { ok: false };

export type ParsedSumilla = {
  title: string;
  text: string;
};

/**
 * Único lector del HTML del buscador oficial.
 * Si la página no trae el total y las filas esperadas, no inventa resultados.
 */
export function readSearchPage(html: string): ParsedSearchPage {
  const source = stripComments(html);
  const text = cheerio.load(source).root().text().replace(/\s+/g, " ");
  const totalMatch = text.match(/devolvi[oó]\s+(\d+)\s+resultados/i);
  if (!totalMatch) {
    if (/no se encontr[oó]\s+resoluciones con el\s+criterio ingresado/i.test(text)) {
      return { ok: true, total: 0, from: 0, to: 0, results: [], extraRows: false };
    }
    return { ok: false };
  }

  const total = Number(totalMatch[1]);
  const range = text.match(/\((\d+)\s*-\s*(\d+)\s+de\s+(\d+)\)/);
  const pairs = pairRows(source);
  if (!pairs) return { ok: false };
  if (total === 0) {
    return { ok: true, total: 0, from: 0, to: 0, results: [], extraRows: false };
  }
  if (pairs.length === 0) return { ok: false };

  const extraRows = pairs.length > PAGE_ROWS;
  const results = pairs.slice(0, PAGE_ROWS);
  const from = range ? Number(range[1]) : 1;
  const to = range ? Number(range[2]) : from + results.length - 1;
  return { ok: true, total, from, to, results, extraRows };
}

export function readSumilla(html: string): ParsedSumilla | null {
  const $ = cheerio.load(stripComments(html));
  const title = collapse($(".txtressup").first().text());
  const text = collapse($(".txtres").first().text());
  if (!title && !text) return null;
  return {
    title: title.slice(0, 300),
    text: text.slice(0, 4000),
  };
}

export function decodeOfficialHtml(bytes: Uint8Array, contentType: string | null, htmlHint = ""): string {
  const fromHeader = contentType?.match(/charset=([^;]+)/i)?.[1]?.trim();
  const fromMeta = htmlHint.match(/charset=([\w:-]+)/i)?.[1];
  const charset = normalizeCharset(fromHeader || fromMeta || "iso-8859-1");
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("iso-8859-1").decode(bytes);
  }
}

function pairRows(html: string): ParsedRow[] | null {
  const pattern =
    /onClick="openPDF\('([^']*)','([^']*)'\)"|onClick="openWindowSumilla\('([^']*)'\)"/g;
  const rows: ParsedRow[] = [];
  let pending: { rawId: string; pdfPath: string } | null = null;

  for (const match of html.matchAll(pattern)) {
    if (match[1] !== undefined) {
      if (pending) return null;
      pending = { rawId: match[1], pdfPath: match[2] };
      continue;
    }
    if (!pending) return null;
    const rawId = pending.rawId;
    const pdfPath = pending.pdfPath;
    const sumillaValor = match[3] ?? "";
    pending = null;
    if (!isExpedienteRef(rawId) || !isOfficialPdfPath(pdfPath) || !isSumillaValor(sumillaValor)) {
      return null;
    }
    rows.push({
      rawId,
      pdfPath,
      sumillaValor,
      id: rawId.replace(/^\/+/, ""),
    });
  }

  if (pending) return null;
  return rows;
}

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCharset(value: string): string {
  const charset = value.toLowerCase().replace(/['"]/g, "");
  if (charset === "latin1" || charset === "latin-1") return "iso-8859-1";
  return charset;
}
