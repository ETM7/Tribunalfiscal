import { decodeOfficialHtml, readSearchPage, readSumilla } from "@/lib/html-reader";
import { previewResolution } from "@/lib/pdf-text";
import {
  buildSearchUrl,
  fichaUrl,
  nextOffset,
  pdfFileUrl,
  sumillaPageUrl,
  type SearchQuery,
} from "@/lib/search-query";
import { salaFromId } from "@/lib/text-search";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 1_500_000;
const PDF_MAX_BYTES = 12_000_000;
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const previewCache = new Map<string, { at: number; value: ResolutionPreview }>();

type ResolutionPreview = { date: string | null; phrasePages: number[] };

export type ListedResolution = {
  id: string;
  pdfPath: string;
  fichaUrl: string | null;
  sumillaTitle: string | null;
  sumillaText: string | null;
  sumillaUrl: string | null;
  date: string | null;
  sala: string | null;
  phrasePages: number[];
};

export type SearchSuccess = {
  status: "ok";
  officialUrl: string;
  total: number;
  from: number;
  to: number;
  count: number;
  nextCount: number | null;
  refine: boolean;
  extraRows: boolean;
  results: ListedResolution[];
};

export type SearchFailure = {
  status: "error";
  message: string;
  officialUrl: string;
};

export type SearchOutcome = SearchSuccess | SearchFailure;

let busy = false;

export async function searchTribunal(query: SearchQuery, count: number): Promise<SearchOutcome> {
  const officialUrl = buildSearchUrl(query, count);
  if (busy) {
    return {
      status: "error",
      message: "Ya hay una búsqueda en curso. Espera a que termine antes de pedir otra.",
      officialUrl,
    };
  }

  busy = true;
  try {
    return await searchOnce(query, count, officialUrl);
  } finally {
    busy = false;
  }
}

async function searchOnce(query: SearchQuery, count: number, officialUrl: string): Promise<SearchOutcome> {
  let page: FetchedHtml;
  try {
    page = await fetchOfficial(officialUrl, "");
  } catch (error) {
    return { status: "error", message: failureMessage(error), officialUrl };
  }

  const parsed = readSearchPage(page.html);
  if (!parsed.ok) {
    return {
      status: "error",
      message: "No pude leer el HTML del buscador oficial. Ábrelo en el MEF con el mismo criterio.",
      officialUrl,
    };
  }

  if (count > 0 && parsed.total > 50) {
    return {
      status: "error",
      message: `Esta búsqueda tiene ${parsed.total} resultados. Afínala antes de pedir otra página.`,
      officialUrl,
    };
  }

  const results: ListedResolution[] = [];
  let cookie = page.cookie;
  for (const row of parsed.results) {
    const sumillaUrl = sumillaPageUrl(row.sumillaValor);
    let sumillaTitle: string | null = null;
    let sumillaText: string | null = null;
    if (sumillaUrl) {
      try {
        const sumillaPage = await fetchOfficial(sumillaUrl, cookie);
        cookie = mergeCookies(cookie, sumillaPage.cookie);
        const sumilla = readSumilla(sumillaPage.html);
        sumillaTitle = sumilla?.title ?? null;
        sumillaText = sumilla?.text ?? null;
      } catch {
        sumillaTitle = null;
        sumillaText = null;
      }
    }
    results.push({
      id: row.id,
      pdfPath: row.pdfPath,
      fichaUrl: fichaUrl(row.rawId, row.pdfPath),
      sumillaTitle,
      sumillaText,
      sumillaUrl,
      date: null,
      sala: salaFromId(row.id),
      phrasePages: [],
    });
  }

  const enriched = await mapLimit(results, 2, (item) => attachPreview(item, query));
  results.splice(0, results.length, ...enriched);

  const to = parsed.to || count + results.length;
  return {
    status: "ok",
    officialUrl,
    total: parsed.total,
    from: parsed.total === 0 ? 0 : parsed.from || count + 1,
    to: parsed.total === 0 ? 0 : to,
    count,
    nextCount: nextOffset(parsed.total, to),
    refine: parsed.total > 50,
    extraRows: parsed.extraRows,
    results,
  };
}

async function attachPreview(item: ListedResolution, query: SearchQuery): Promise<ListedResolution> {
  if (!item.pdfPath || !pdfFileUrl(item.pdfPath)) return item;
  const started = Date.now();
  try {
    const preview = await withTimeout(loadPreview(item.pdfPath, query), 25_000);
    console.info(
      `[preview] ${item.id} ${Date.now() - started}ms fecha=${preview.date ?? "-"} págs=${preview.phrasePages.join(",") || "-"}`,
    );
    return { ...item, date: preview.date, phrasePages: preview.phrasePages };
  } catch (error) {
    console.info(`[preview] ${item.id} ${error instanceof Error ? error.message : "error"}`);
    return item;
  }
}

async function loadPreview(pdfPath: string, query: SearchQuery): Promise<ResolutionPreview> {
  const key = `${pdfPath}\n${query.exacta}\n${query.todas}\n${query.cerca}`;
  const cached = previewCache.get(key);
  if (cached && Date.now() - cached.at < PREVIEW_TTL_MS) return cached.value;
  const value = await previewResolution(await downloadOfficialPdf(pdfPath), {
    exacta: query.exacta,
    todas: query.todas,
    cerca: query.cerca,
  });
  if (value.date || value.phrasePages.length > 0) {
    previewCache.set(key, { at: Date.now(), value });
    if (previewCache.size > 40) {
      const oldest = [...previewCache.entries()].sort((left, right) => left[1].at - right[1].at)[0];
      if (oldest) previewCache.delete(oldest[0]);
    }
  }
  return value;
}

async function downloadOfficialPdf(pdfPath: string): Promise<Uint8Array> {
  const url = pdfFileUrl(pdfPath);
  if (!url) throw new Error("pdf");
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "application/pdf", "User-Agent": USER_AGENT },
  });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "http:" && finalUrl.protocol !== "https:") throw new Error("host");
  if (finalUrl.hostname !== "www.mef.gob.pe") throw new Error("host");
  if (!finalUrl.pathname.startsWith("/contenidos/tribu_fisc/Tribunal_Fiscal/PDFS/")) throw new Error("host");
  if (!response.ok) throw new Error("http");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > PDF_MAX_BYTES) throw new Error("size");
  if (!new TextDecoder().decode(bytes.slice(0, 5)).startsWith("%PDF")) throw new Error("pdf");
  return bytes;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  void promise.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const runNext = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => runNext()));
  return out;
}

type FetchedHtml = { html: string; cookie: string };

async function fetchOfficial(url: string, cookie: string): Promise<FetchedHtml> {
  assertOfficialUrl(url);
  console.info(`[mef] ${url}`);
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-PE,es;q=0.9",
      "User-Agent": USER_AGENT,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });

  assertOfficialUrl(response.url);
  if (!response.ok) {
    throw new OfficialHttpError(response.status);
  }
  const contentType = response.headers.get("content-type");
  if (contentType?.toLowerCase().includes("pdf")) {
    throw new Error("pdf");
  }
  const length = Number(response.headers.get("content-length") || "0");
  if (length > MAX_BYTES) throw new Error("size");

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error("size");
  const hinted = new TextDecoder("iso-8859-1").decode(bytes.slice(0, 400));
  return {
    html: decodeOfficialHtml(bytes, contentType, hinted),
    cookie: mergeCookies(cookie, cookieFrom(response)),
  };
}

function assertOfficialUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("host");
  if (url.hostname !== "apps4.mineco.gob.pe") throw new Error("host");
}

function cookieFrom(response: Response): string {
  const jar = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return jar
    .map((item) => item.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function mergeCookies(current: string, next: string): string {
  const map = new Map<string, string>();
  for (const part of `${current}; ${next}`.split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const name = trimmed.slice(0, trimmed.indexOf("="));
    map.set(name, trimmed);
  }
  return [...map.values()].join("; ");
}

function failureMessage(error: unknown): string {
  if (error instanceof OfficialHttpError) {
    return `El sitio del MEF respondió con un error (${error.status}). Puedes abrir la misma búsqueda allá.`;
  }
  if (isTimeout(error)) {
    return "El sitio del MEF no respondió a tiempo. Puedes abrir la misma búsqueda en el formulario oficial.";
  }
  return "El sitio del MEF no respondió. Puedes abrir la misma búsqueda en el formulario oficial.";
}

class OfficialHttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`http ${status}`);
    this.status = status;
  }
}

function isTimeout(error: unknown): boolean {
  return (
    (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error.name === "TimeoutError" || error.name === "AbortError"))
  );
}
