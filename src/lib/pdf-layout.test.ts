import assert from "node:assert/strict";
import test from "node:test";
import { extractResumen, headerSpan, inkBands, linesFromTsv, reflowLines, signatureSpan, tableSpans } from "./pdf-layout";

test("el encabezado toma el escudo y el título, no el cuerpo", () => {
  const bands = [
    { top: 80, bottom: 106, height: 27 },
    { top: 118, bottom: 240, height: 123 },
    { top: 261, bottom: 324, height: 64 },
    { top: 361, bottom: 380, height: 20 },
  ];
  const span = headerSpan(bands, 1760);
  assert.ok(span);
  assert.equal(span.top, 70);
  assert.equal(span.bottom, 338);
});

test("las firmas del final quedan en un solo recorte", () => {
  const bands = [
    { top: 812, bottom: 829, height: 18 },
    { top: 915, bottom: 1058, height: 144 },
    { top: 1061, bottom: 1164, height: 104 },
    { top: 1173, bottom: 1189, height: 17 },
    { top: 1198, bottom: 1213, height: 16 },
    { top: 1548, bottom: 1564, height: 17 },
  ];
  const span = signatureSpan(bands, 1760);
  assert.deepEqual(span, { top: 905, bottom: 1225 });
});

test("una tabla es un grupo de líneas horizontales cercanas", () => {
  const spans = tableSpans([1279, 1322, 1349, 1392, 1414, 1458, 1480, 1500, 1522, 1543, 300]);
  assert.deepEqual(spans[0], { top: 1273, bottom: 1549 });
});

test("una línea suelta debajo de la tabla no entra en el recorte", () => {
  const spans = tableSpans([281, 302, 323, 343, 373, 418]);
  assert.deepEqual(spans, [{ top: 275, bottom: 379 }]);
});

test("el resumen es la parte resolutiva", () => {
  const resumen = extractResumen(
    "VISTA la apelación. CONSIDERANDO: Que el escrito. RESUELVE: Declarar INFUNDADA la solicitud de aclaración presentada. Regístrese, comuníquese y remítase."
  );
  assert.match(resumen, /Declarar INFUNDADA/);
  assert.equal(resumen.includes("Regístrese"), false);
});

test("el texto justificado junta los renglones de un párrafo", () => {
  const paragraphs = reflowLines([
    "Que la recurrente sostiene que",
    "debe aplicar la Decisión 578.",
    "RESUELVE:",
    "Confirmar la apelada.",
  ]);
  assert.deepEqual(paragraphs, [
    "Que la recurrente sostiene que debe aplicar la Decisión 578.",
    "RESUELVE:",
    "Confirmar la apelada.",
  ]);
});

test("tsv agrupa las palabras de una línea", () => {
  const tsv = [
    "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
    "5\t1\t1\t1\t1\t1\t10\t100\t40\t12\t90\tRESUELVE:",
    "5\t1\t1\t1\t2\t1\t10\t130\t50\t12\t90\tDeclarar",
    "5\t1\t1\t1\t2\t2\t70\t130\t80\t12\t90\tINFUNDADA",
  ].join("\n");
  const lines = linesFromTsv(tsv);
  assert.equal(lines[1]?.text, "Declarar INFUNDADA");
  assert.equal(inkBands([0, 0.02, 0.02, 0]).length, 1);
});
