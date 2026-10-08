import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchUrl, fichaUrl, nextOffset, parseSearchForm } from "./search-query";

function data(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

test("sin filtro de fecha no manda el hasta de 2007", () => {
  const parsed = parseSearchForm(data({ exacta: "contrato de estabilidad", alcance: "sumilla" }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const url = new URL(buildSearchUrl(parsed.query, 0));
  assert.equal(url.searchParams.get("exacta"), "contrato de estabilidad");
  assert.equal(url.searchParams.get("rtfSumilla"), "2");
  assert.equal(latin1Param(url.href, "Buscar"), "Iniciar Búsqueda");
  assert.match(url.href, /Buscar=Iniciar\+B%FAsqueda/);
  assert.equal(url.searchParams.has("fechaBegin"), false);
  assert.equal(url.searchParams.has("fechaEnd"), false);
  assert.equal(url.searchParams.has("filtroFecha"), false);
  assert.equal(url.searchParams.has("count"), false);
});

test("la página siguiente no adelanta fechas ni un count distinto", () => {
  const parsed = parseSearchForm(
    data({ exacta: "contrato de estabilidad", paso: "siguiente", count: "5", alcance: "sumilla" })
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.count, 5);
  const url = new URL(buildSearchUrl(parsed.query, parsed.count));
  assert.equal(url.searchParams.get("Buscar"), "navegator");
  assert.equal(url.searchParams.get("count"), "5");
  assert.equal(url.searchParams.has("fechaEnd"), false);
});

test("más de 50 resultados no ofrece la página siguiente", () => {
  assert.equal(nextOffset(26, 5), 5);
  assert.equal(nextOffset(26, 26), null);
  assert.equal(nextOffset(2489, 5), null);
});

test("la tilde sale en ISO-8859-1, que es el juego del formulario oficial", () => {
  const parsed = parseSearchForm(data({ exacta: "decisión 578", alcance: "sumilla" }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const href = buildSearchUrl(parsed.query, 0);
  assert.match(href, /exacta=decisi%F3n\+578/);
  assert.equal(href.includes("%C3%B3"), false);
  assert.equal(latin1Param(href, "exacta"), "decisión 578");
});

test("un carácter fuera del formulario oficial no se envía", () => {
  const parsed = parseSearchForm(data({ exacta: "decisión 578 😀" }));
  assert.equal(parsed.ok, false);
});

test("la exclusión sola no sale hacia el MEF", () => {
  const parsed = parseSearchForm(data({ sin: "multa" }));
  assert.equal(parsed.ok, false);
});

test("el enlace de ficha apunta a Descargas del MEF", () => {
  const url = fichaUrl("2013_1_08252", "2013/1/2013_1_08252.pdf");
  assert.ok(url);
  const parsed = new URL(url!);
  assert.equal(parsed.hostname, "apps4.mineco.gob.pe");
  assert.equal(parsed.pathname, "/ServiciosTF/Descargas.htm");
  assert.match(parsed.searchParams.get("fullpath") || "", /2013_1_08252\.pdf\|2013_1_08252$/);
});

function latin1Param(href: string, name: string): string | null {
  const query = href.slice(href.indexOf("?") + 1);
  for (const part of query.split("&")) {
    const eq = part.indexOf("=");
    const key = decodeLatin1(part.slice(0, eq));
    const value = decodeLatin1(part.slice(eq + 1));
    if (key === name) return value;
  }
  return null;
}

function decodeLatin1(value: string): string {
  const plus = value.replace(/\+/g, " ");
  const bytes: number[] = [];
  for (let index = 0; index < plus.length; index += 1) {
    if (plus[index] === "%" && index + 2 < plus.length) {
      bytes.push(Number.parseInt(plus.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    bytes.push(plus.charCodeAt(index));
  }
  return Buffer.from(bytes).toString("latin1");
}
