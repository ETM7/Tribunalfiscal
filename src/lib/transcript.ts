import { buildEditableHtml, buildPdfTranscript, locateCriteria, readPdfPages, type CriterionHit, type PdfPage } from "@/lib/pdf-text";
import { pdfFileUrl } from "@/lib/search-query";

const MAX_BYTES = 12_000_000;
const FIELD_MAX = 200;
const CACHE_MS = 30 * 60 * 1000;
const CACHE_VERSION = 3;

type CachedRead = {
  pages: PdfPage[];
  truncated: boolean;
  signatureImage: string | null;
  resumen: string;
};

type ReaderSlot = {
  version: number;
  inflight: Map<string, Promise<CachedRead>>;
  cache: Map<string, { at: number; value: CachedRead }>;
  tail: Promise<void>;
};

function readerSlot(): ReaderSlot {
  const holder = globalThis as typeof globalThis & { __rtfReader?: ReaderSlot };
  if (!holder.__rtfReader || holder.__rtfReader.version !== CACHE_VERSION) {
    holder.__rtfReader = { version: CACHE_VERSION, inflight: new Map(), cache: new Map(), tail: Promise.resolve() };
  }
  return holder.__rtfReader;
}

function enqueueRead<T>(job: () => Promise<T>): Promise<T> {
  const slot = readerSlot();
  const run = slot.tail.then(job, job);
  slot.tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export type TranscriptRequest = {
  id: string;
  pdfPath: string;
  exacta: string;
  todas: string;
  cerca: string;
  sumillaUrl: string | null;
};

export type PreparedTranscript = {
  id: string;
  pdfUrl: string;
  sumillaUrl: string | null;
  pages: PdfPage[];
  hits: CriterionHit[];
  truncated: boolean;
  signatureImage: string | null;
  resumen: string;
  summary: string;
  document: string;
  html: string;
  filename: string;
};

export function parseTranscriptRequest(fields: {
  id: string;
  pdfPath: string;
  exacta: string;
  todas: string;
  cerca: string;
  sumillaUrl: string;
}): { ok: true; request: TranscriptRequest } | { ok: false; message: string } {
  const id = fields.id.trim();
  const pdfPath = fields.pdfPath.trim();
  const exacta = fields.exacta.trim();
  const todas = fields.todas.trim();
  const cerca = fields.cerca.trim();
  const sumillaUrl = fields.sumillaUrl.trim();
  if (!/^\d{4}_\d+_\d+$/.test(id)) return { ok: false, message: "La resolución no es válida." };
  if (!pdfFileUrl(pdfPath)) return { ok: false, message: "El PDF indicado no pertenece al buscador del MEF." };
  if ([exacta, todas, cerca].some((field) => field.length > FIELD_MAX)) {
    return { ok: false, message: "El criterio es demasiado largo." };
  }
  if (sumillaUrl && !/^https:\/\/apps4\.mineco\.gob\.pe\/ServiciosTF\/Sumilla\.htm\?valor=\d+$/.test(sumillaUrl)) {
    return { ok: false, message: "La sumilla indicada no pertenece al MEF." };
  }
  return { ok: true, request: { id, pdfPath, exacta, todas, cerca, sumillaUrl: sumillaUrl || null } };
}

export async function prepareTranscript(request: TranscriptRequest): Promise<PreparedTranscript> {
  const pdfUrl = pdfFileUrl(request.pdfPath);
  if (!pdfUrl) throw new Error("El PDF indicado no pertenece al buscador del MEF.");

  try {
    const read = await readResolution(request.pdfPath, pdfUrl);
    const hits = locateCriteria(read.pages, request);
    const input = {
      id: request.id,
      pdfUrl,
      sumillaUrl: request.sumillaUrl,
      pages: read.pages,
      hits,
      truncated: read.truncated,
      signatureImage: read.signatureImage,
      resumen: read.resumen,
    };
    return {
      ...input,
      summary: hits
        .map((hit) => `${hit.label}: ${hit.pages.length ? `páginas ${hit.pages.join(", ")}` : "no aparece"}`)
        .join(" · "),
      document: buildPdfTranscript(input),
      html: buildEditableHtml(input),
      filename: `${request.id}-editable.html`,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("En este servidor")) throw error;
    if (error instanceof Error && /espera a que termine|no trajo páginas|no pertenece|tardó demasiado/i.test(error.message)) {
      throw error;
    }
    throw new Error("No pude leer las páginas del PDF. Ábrelo en el MEF.");
  }
}

async function readResolution(pdfPath: string, pdfUrl: string): Promise<CachedRead> {
  const slot = readerSlot();
  const cached = slot.cache.get(pdfPath);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const pending = slot.inflight.get(pdfPath);
  if (pending) return pending;

  const job = enqueueRead(async () => {
    const again = slot.cache.get(pdfPath);
    if (again && Date.now() - again.at < CACHE_MS) return again.value;
    const bytes = await downloadPdf(pdfUrl);
    const read = await readPdfPages(bytes);
    if (read.pages.length === 0) throw new Error("El PDF no trajo páginas legibles.");
    const value: CachedRead = {
      pages: read.pages,
      truncated: read.truncated,
      signatureImage: read.signatureImage,
      resumen: read.resumen,
    };
    slot.cache.set(pdfPath, { at: Date.now(), value });
    return value;
  });
  slot.inflight.set(pdfPath, job);
  try {
    return await job;
  } finally {
    if (slot.inflight.get(pdfPath) === job) slot.inflight.delete(pdfPath);
  }
}

async function downloadPdf(pdfUrl: string): Promise<Uint8Array> {
  const response = await fetch(pdfUrl, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: "application/pdf", "User-Agent": "Mozilla/5.0" },
  });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "http:" && finalUrl.protocol !== "https:") throw new Error("host");
  if (finalUrl.hostname !== "www.mef.gob.pe") throw new Error("host");
  if (!finalUrl.pathname.startsWith("/contenidos/tribu_fisc/Tribunal_Fiscal/PDFS/")) throw new Error("host");
  if (!response.ok) throw new Error("http");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error("size");
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (!header.startsWith("%PDF")) throw new Error("pdf");
  return bytes;
}
