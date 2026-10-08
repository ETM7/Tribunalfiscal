import assert from "node:assert/strict";
import test from "node:test";
import { buildEditableHtml, buildPdfTranscript, foldForSearch, locateCriteria, pagesFromTextLayer, textLayerIsUsable } from "./pdf-text";

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
  assert.match(html, /Decisión 578 &lt;script&gt;/);
});

test("un escaneo sin capa de texto no se toma como texto", () => {
  assert.equal(textLayerIsUsable("\f\f\n"), false);
  const layered = pagesFromTextLayer("Página uno\fPágina dos\f");
  assert.deepEqual(
    layered.map((page) => page.text),
    ["Página uno", "Página dos"]
  );
});
