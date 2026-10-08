import { decodeOfficialHtml, readSearchPage, readSumilla } from "@/lib/html-reader";
import {
  buildSearchUrl,
  fichaUrl,
  nextOffset,
  sumillaPageUrl,
  type SearchQuery,
} from "@/lib/search-query";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 1_500_000;

export type ListedResolution = {
  id: string;
  pdfPath: string;
  fichaUrl: string | null;
  sumillaTitle: string | null;
  sumillaText: string | null;
  sumillaUrl: string | null;
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
    });
  }

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
