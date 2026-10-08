export const PAGE_SIZE = 5;
export const REFINE_ABOVE = 50;
export const MAX_OFFSET = 45;

const OFFICIAL_ORIGIN = "https://apps4.mineco.gob.pe";
const SEARCH_PATH = "/ServiciosTF/nuevo_ContenidoAvanzado.htm";
const PDF_ROOT =
  "http://www.mef.gob.pe/contenidos/tribu_fisc/Tribunal_Fiscal/PDFS/";

const DATE_RE = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/;
const FIELD_MAX = 200;

export type Alcance = "sumilla" | "completo";

export type SearchQuery = {
  exacta: string;
  todas: string;
  sin: string;
  cerca: string;
  max: number;
  alcance: Alcance;
  filtrarFecha: boolean;
  fechaBegin: string;
  fechaEnd: string;
};

export type ParsedForm =
  | { ok: true; query: SearchQuery; count: number }
  | { ok: false; message: string };

export function todayInLima(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(now);
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1964";
  return `${day}/${month}/${year}`;
}

export function parseSearchForm(formData: FormData): ParsedForm {
  const exacta = field(formData, "exacta");
  const todas = field(formData, "todas");
  const sin = field(formData, "sin");
  const cerca = field(formData, "cerca");
  const alcance = formData.get("alcance") === "completo" ? "completo" : "sumilla";
  const filtrarFecha = formData.get("filtrarFecha") === "on";
  const fechaBegin = field(formData, "fechaBegin");
  const fechaEnd = field(formData, "fechaEnd");
  const paso = formData.get("paso") === "siguiente" ? "siguiente" : "buscar";

  if ([exacta, todas, sin, cerca, fechaBegin, fechaEnd].some((value) => value.length > FIELD_MAX)) {
    return { ok: false, message: "Uno de los campos es demasiado largo." };
  }

  if (![exacta, todas, sin, cerca, fechaBegin, fechaEnd].every(fitsOfficialCharset)) {
    return {
      ok: false,
      message: "Hay un carácter que el formulario oficial no acepta. Cámbialo por el que usarías en el MEF.",
    };
  }

  if (!exacta && !todas && !cerca) {
    return {
      ok: false,
      message:
        "Escribe una frase, palabras que deben estar, o palabras cercanas. Excluir palabras, por sí solo, no basta.",
    };
  }

  let max = 20;
  if (cerca) {
    const rawMax = field(formData, "max") || "20";
    if (!/^\d{1,4}$/.test(rawMax) || Number(rawMax) < 1) {
      return {
        ok: false,
        message: "La ventana de cercanía tiene que ser un número de 1 a 9999.",
      };
    }
    max = Number(rawMax);
  }

  if (filtrarFecha) {
    const begin = parseDate(fechaBegin);
    const end = parseDate(fechaEnd);
    if (!begin || !end) {
      return {
        ok: false,
        message: "Las fechas van en formato dd/mm/aaaa, entre 1964 y el año en curso.",
      };
    }
    if (begin.time > end.time) {
      return { ok: false, message: "La fecha inicial no puede ser posterior a la final." };
    }
  }

  let count = 0;
  if (paso === "siguiente") {
    const rawCount = field(formData, "count");
    if (!/^\d+$/.test(rawCount)) {
      return { ok: false, message: "La página pedida no es válida." };
    }
    count = Number(rawCount);
    if (count < PAGE_SIZE || count > MAX_OFFSET || count % PAGE_SIZE !== 0) {
      return {
        ok: false,
        message: "Solo se pide la página siguiente, de cinco en cinco, dentro de los primeros 50.",
      };
    }
  }

  return {
    ok: true,
    count,
    query: {
      exacta,
      todas,
      sin,
      cerca,
      max,
      alcance,
      filtrarFecha,
      fechaBegin: filtrarFecha ? fechaBegin : "",
      fechaEnd: filtrarFecha ? fechaEnd : "",
    },
  };
}

export function buildSearchUrl(query: SearchQuery, count: number): string {
  const params: Array<[string, string]> = [["rtfSumilla", query.alcance === "completo" ? "1" : "2"]];
  if (query.todas) params.push(["todas", query.todas]);
  if (query.exacta) params.push(["exacta", query.exacta]);
  if (query.sin) params.push(["sin", query.sin]);
  if (query.cerca) {
    params.push(["cerca", query.cerca]);
    params.push(["max", String(query.max)]);
  }
  if (query.filtrarFecha) {
    params.push(["filtroFecha", "on"]);
    params.push(["fechaBegin", query.fechaBegin]);
    params.push(["fechaEnd", query.fechaEnd]);
  }
  if (count > 0) {
    params.push(["Buscar", "navegator"]);
    params.push(["count", String(count)]);
  } else {
    params.push(["Buscar", "Iniciar Búsqueda"]);
  }
  const queryString = params.map(([key, value]) => `${encodeLatin1Form(key)}=${encodeLatin1Form(value)}`).join("&");
  return `${OFFICIAL_ORIGIN}${SEARCH_PATH}?${queryString}`;
}

export function pdfFileUrl(pdfPath: string): string | null {
  if (!/^\d{4}\/\d{1,2}\/[^"'<>\\]+\.pdf$/i.test(pdfPath)) return null;
  return `${PDF_ROOT}${pdfPath}`;
}

export function fichaUrl(rawId: string, pdfPath: string): string | null {
  if (!/^\/?\d{4}_\d+_\d+$/.test(rawId)) return null;
  if (!/^\d{4}\/\d{1,2}\/[^"'<>\\]+\.pdf$/i.test(pdfPath)) return null;
  const fullpath = `${PDF_ROOT}${pdfPath}|${rawId}`;
  const url = new URL("/ServiciosTF/Descargas.htm", OFFICIAL_ORIGIN);
  url.searchParams.set("fullpath", fullpath);
  return url.toString();
}

export function sumillaPageUrl(valor: string): string | null {
  if (!/^\d+$/.test(valor)) return null;
  const url = new URL("/ServiciosTF/Sumilla.htm", OFFICIAL_ORIGIN);
  url.searchParams.set("valor", valor);
  return url.toString();
}

export function nextOffset(total: number, to: number): number | null {
  if (!Number.isFinite(total) || !Number.isFinite(to)) return null;
  if (total > REFINE_ABOVE) return null;
  if (to >= total) return null;
  if (to > MAX_OFFSET) return null;
  return to;
}

export function queryLabel(query: SearchQuery): string {
  const head = query.exacta || query.todas || query.cerca || "Búsqueda";
  const where = query.alcance === "sumilla" ? "sumilla" : "texto completo";
  const extra = query.sin ? ` sin ${query.sin}` : "";
  const label = `${head} · ${where}${extra}`;
  return label.length > 90 ? `${label.slice(0, 87)}…` : label;
}

function fitsOfficialCharset(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0xff) return false;
  }
  return true;
}

/** El formulario del MEF está en ISO-8859-1. UTF-8 convierte «ó» en «Ã³» y la búsqueda no coincide. */
function encodeLatin1Form(value: string): string {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0xff) throw new Error("charset");
    if (code === 0x20) {
      out += "+";
      continue;
    }
    const unreserved =
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      code === 0x2a ||
      code === 0x2d ||
      code === 0x2e ||
      code === 0x5f;
    if (unreserved) {
      out += value[index];
      continue;
    }
    out += `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().normalize("NFC") : "";
}

function parseDate(value: string): { time: number } | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const currentYear = Number(todayInLima().slice(-4));
  if (year < 1964 || year > currentYear) return null;
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { time };
}
