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
