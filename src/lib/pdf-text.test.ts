import assert from "node:assert/strict";
import test from "node:test";
import { buildEditableHtml, buildPdfTranscript, foldForSearch, locateCriteria, pagesFromTextLayer, phraseSpans, previewPhrasePages, searchTerms, splitHighlighted, textLayerIsUsable } from "./pdf-text";
import { parseResolutionDate, salaFromId } from "./text-search";

test("la frase admite un número entre Decisión y 578", () => {
  const pages = [
    { page: 1, text: "materia distinta", headerImage: null, blocks: [] },
    { page: 5, text: "además de la Decisión 578, esto último", headerImage: null, blocks: [] },
    { page: 6, text: "como regalías de acuerdo a la Decisión N° 578", headerImage: null, blocks: [] },
  ];
  const hits = locateCriteria(pages, { exacta: "decisión 578", todas: "no domiciliados", cerca: "" });
  assert.deepEqual(hits[0], { label: "Frase «decisión 578»", pages: [5, 6] });
  assert.deepEqual(hits[1]?.pages, []);
});

test("ignora la palabra no y marca domiciliados", () => {
  const pages = [
    { page: 1, text: "Retenciones del Impuesto a la Renta de No Domiciliados", headerImage: null, blocks: [] },
    { page: 2, text: "no hay más hechos", headerImage: null, blocks: [] },
  ];
  const hits = locateCriteria(pages, { exacta: "", todas: "no domiciliados", cerca: "" });
  assert.deepEqual(hits[0]?.pages, [1]);
  assert.equal(foldForSearch("Decisión"), "decision");
});

test("el documento separa la sumilla del texto por página", () => {
  const document = buildPdfTranscript({
    id: "2019_10_11221",
    pdfUrl: "http://www.mef.gob.pe/contenidos/tribu_fisc/Tribunal_Fiscal/PDFS/2019/10/2019_10_11221.pdf",
    sumillaUrl: "https://apps4.mineco.gob.pe/ServiciosTF/Sumilla.htm?valor=2019011221",
    pages: [{ page: 5, text: "Decisión 578", headerImage: null, blocks: [{ type: "p", text: "Decisión 578" }] }],
    hits: [{ label: "Frase «decisión 578»", pages: [5] }],
    terms: searchTerms({ exacta: "decisión 578", todas: "", cerca: "" }),
    truncated: false,
    signatureImage: null,
    resumen: "Confirmar la apelada.",
  });
  assert.match(document, /no corresponde a un número de página/);
  assert.match(document, /páginas 5/);
  assert.match(document, /----- Página 5 -----/);
});

test("el html editable escapa el texto y deja Buscar en el navegador", () => {
  const html = buildEditableHtml({
    id: "2020_10_00975",
    pdfUrl: "http://www.mef.gob.pe/contenidos/tribu_fisc/Tribunal_Fiscal/PDFS/2020/10/2020_10_00975.pdf",
    sumillaUrl: "https://apps4.mineco.gob.pe/ServiciosTF/Sumilla.htm?valor=2020000975",
    pages: [
      {
        page: 3,
        text: "Decisión 578 <script>",
        headerImage: null,
        blocks: [{ type: "p", text: "Decisión 578 <script>" }],
      },
    ],
    hits: [{ label: "Frase «decisión 578»", pages: [3] }],
    terms: searchTerms({ exacta: "decisión 578", todas: "no domiciliados", cerca: "" }),
    truncated: false,
    signatureImage: null,
    resumen: "Declarar infundada la solicitud.",
  });
  assert.match(html, /contenteditable="true"/);
  assert.match(html, /Descargar archivo editable/);
  assert.match(html, /Página 3 — aquí aparece el criterio/);
  assert.match(html, /Resumen del PDF/);
  assert.match(html, /text-align: justify/);
  assert.equal(html.includes("Decisión 578 <script>"), false);
  assert.match(html, /<mark>Decisión<\/mark> <mark>578<\/mark> &lt;script&gt;/);
  assert.equal(html.includes("<mark>script</mark>"), false);
});

test("buscar en la resolución encuentra la frase aunque cambie la tilde", () => {
  const text = "la Decisión 578, y otra vez la DECISIÓN  578. No cuenta indecision ni Decisión N° 100.";
  const spans = phraseSpans(text, "decisión 578");
  assert.deepEqual(
    spans.map((span) => text.slice(span.start, span.end)),
    ["Decisión 578", "DECISIÓN  578"]
  );
  assert.deepEqual(phraseSpans(text, "   "), []);
});

test("el resaltado amarillo sigue la palabra aunque cambie la tilde y omite no", () => {
  const terms = searchTerms({ exacta: "decisión 578", todas: "no domiciliados", cerca: "" });
  assert.deepEqual(terms, ["decision", "578", "domiciliados"]);
  const pieces = splitHighlighted("Retenciones de No Domiciliados según la Decisión N° 578.", terms);
  assert.deepEqual(
    pieces.filter((piece) => piece.hit).map((piece) => piece.text),
    ["Domiciliados", "Decisión", "578"]
  );
});

test("la fecha está junto a la palabra fecha y la sala sale del expediente", () => {
  const header = "FECHA. Uma, 3 de diciembre de 2019\nVISTA la apelación del 31 de octubre de 2018";
  assert.equal(parseResolutionDate(header), "03/12/2019");
  assert.equal(parseResolutionDate("Fecha: Lima, 23 de mayo de 2017"), "23/05/2017");
  assert.equal(parseResolutionDate("FECHA Lima, 3 de setiembre del 2018"), "03/09/2018");
  assert.equal(parseResolutionDate("VISTA el 31 de octubre de 2018"), null);
  assert.equal(salaFromId("2017_1_04481"), "Sala 1");
  assert.equal(salaFromId("2025_Q_04131"), "Sala Q");
  assert.equal(salaFromId("/2026_13_08270"), "Sala 13");
  assert.equal(salaFromId("no-es"), null);
});

test("las páginas de la ficha siguen la frase exacta", () => {
  const pages = [
    { page: 2, text: "no domiciliados, sin la frase", headerImage: null, blocks: [] },
    { page: 5, text: "la Decisión 578 otra vez", headerImage: null, blocks: [] },
  ];
  assert.deepEqual(previewPhrasePages(pages, { exacta: "decisión 578", todas: "domiciliados", cerca: "" }), [5]);
  assert.deepEqual(previewPhrasePages(pages, { exacta: "no está", todas: "domiciliados", cerca: "" }), []);
  assert.deepEqual(previewPhrasePages(pages, { exacta: "", todas: "domiciliados", cerca: "" }), [2]);
});

test("un escaneo sin capa de texto no se toma como texto", () => {
  assert.equal(textLayerIsUsable("\f\f\n"), false);
  const layered = pagesFromTextLayer("Página uno\fPágina dos\f");
  assert.deepEqual(
    layered.map((page) => page.text),
    ["Página uno", "Página dos"]
  );
});
