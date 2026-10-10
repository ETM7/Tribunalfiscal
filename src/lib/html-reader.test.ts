import assert from "node:assert/strict";
import test from "node:test";
import { readSearchPage, readSumilla } from "./html-reader";

const page = `
<html><body>
La b&uacute;squeda devolvi&oacute; <strong>26</strong> resultados
(1-5 de 26)
<!-- onClick="openPDF('1999_1_00001','1999/1/1999_1_00001.pdf')" -->
<a onClick="openPDF('2013_1_08252','2013/1/2013_1_08252.pdf')">2013_1_08252</a>
<a onClick="openWindowSumilla('2013008252')">Sumilla</a>
<a onClick="openPDF('/2013_10_08997','2013/10/2013_10_08997.pdf')">/2013_10_08997</a>
<a onClick="openWindowSumilla('2013008997')">Sumilla</a>
</body></html>
`;

test("lee total, identificador y descarta comentarios", () => {
  const parsed = readSearchPage(page);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.total, 26);
  assert.equal(parsed.from, 1);
  assert.equal(parsed.to, 5);
  assert.deepEqual(
    parsed.results.map((row) => row.id),
    ["2013_1_08252", "2013_10_08997"]
  );
  assert.equal(parsed.results[1]?.rawId, "/2013_10_08997");
  assert.equal(parsed.results[0]?.sumillaValor, "2013008252");
});

test("sin coincidencias es un total de cero, no una página ilegible", () => {
  const parsed = readSearchPage(`
    <html><body>
      <font color="red"><strong>No se encontr&oacute; resoluciones con el
      criterio ingresado.</strong></font>
    </body></html>
  `);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.total, 0);
  assert.deepEqual(parsed.results, []);
});

const salaLetra = `
<html><body>
La búsqueda devolvió <strong>5</strong> resultados
(1-5 de 5)
<a onClick="openPDF('2026_4_01498','2026/4/2026_4_01498.pdf')">2026_4_01498</a>
<a onClick="openWindowSumilla('2026001498')">Sumilla</a>
<a onClick="openPDF('2024_1_07909','2024/1/2024_1_07909.pdf')">2024_1_07909</a>
<a onClick="openWindowSumilla('2024007909')">Sumilla</a>
<a onClick="openPDF('2025_1_01795','2025/1/2025_1_01795.pdf')">2025_1_01795</a>
<a onClick="openWindowSumilla('2025001795')">Sumilla</a>
<a onClick="openPDF('/2026_13_08270','2026/13/2026_13_08270.pdf')">/2026_13_08270</a>
<a onClick="openWindowSumilla('2026008270')">Sumilla</a>
<a onClick="openPDF('2025_Q_04131','2025/Q/2025_Q_04131.pdf')">2025_Q_04131</a>
<a onClick="openWindowSumilla('2025Q04131')">Sumilla</a>
</body></html>
`;

test("acepta la sala con letra y el valor de sumilla que la incluye", () => {
  const parsed = readSearchPage(salaLetra);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.total, 5);
  assert.deepEqual(
    parsed.results.map((row) => row.id),
    ["2026_4_01498", "2024_1_07909", "2025_1_01795", "2026_13_08270", "2025_Q_04131"]
  );
  assert.equal(parsed.results[4]?.pdfPath, "2025/Q/2025_Q_04131.pdf");
  assert.equal(parsed.results[4]?.sumillaValor, "2025Q04131");
});

test("un identificador ajeno al MEF no se convierte en resultado", () => {
  const parsed = readSearchPage(`
    <html><body>
      La búsqueda devolvió 1 resultados (1-1 de 1)
      <a onClick="openPDF('nota','../secreto.pdf')">nota</a>
      <a onClick="openWindowSumilla('x')">Sumilla</a>
    </body></html>
  `);
  assert.equal(parsed.ok, false);
});

test("si el HTML no tiene la grilla, no inventa filas", () => {
  const parsed = readSearchPage("<html><body><p>Incapsula</p></body></html>");
  assert.equal(parsed.ok, false);
});

test("lee el título y el párrafo de la sumilla", () => {
  const sumilla = readSumilla(`
    <table><tr><td class="txtressup">Sumilla RTF:08252-1-2013</td></tr>
    <tr><td class="txtres">Se confirma la apelada.</td></tr></table>
  `);
  assert.equal(sumilla?.title, "Sumilla RTF:08252-1-2013");
  assert.equal(sumilla?.text, "Se confirma la apelada.");
});
