"use client";

import { useState } from "react";

const MARK = "Decisión 578";

type Paragraph = {
  text: string;
  marked: boolean;
};

const PAGES: Record<number, Paragraph[]> = {
  1: [
    {
      text: "Lima, 12 de diciembre de 2019. Vista la apelación interpuesta contra la Resolución de Intendencia…",
      marked: false,
    },
    {
      text: "Que la recurrente sostiene que las retribuciones a no domiciliados están amparadas en la Decisión 578 y no se encuentran gravadas en el país.",
      marked: true,
    },
    {
      text: "Que la Administración considera que el servicio fue utilizado económicamente en el país…",
      marked: false,
    },
  ],
  3: [
    {
      text: "Que el artículo 14 de la Decisión 578 regula las rentas por servicios profesionales, técnicos, de asistencia técnica y consultoría.",
      marked: true,
    },
    {
      text: "Que, para tal efecto, debe determinarse el lugar donde se imputa y registra el gasto…",
      marked: false,
    },
    {
      text: "Que obran en autos los contratos y comprobantes emitidos por la proveedora…",
      marked: false,
    },
  ],
  7: [
    {
      text: "Que, de lo actuado se aprecia que la Administración reparó las retribuciones pagadas a sujetos no domiciliados por servicios prestados desde el exterior.",
      marked: false,
    },
    {
      text: "Que, conforme con la Decisión 578 de la Comunidad Andina, las rentas obtenidas por empresas de servicios profesionales, técnicos o de consultoría solo serán gravables en el País Miembro en cuyo territorio se imputa y registra su correspondiente gasto.",
      marked: true,
    },
    {
      text: "Que, en consecuencia, corresponde revocar la apelada en este extremo y dejar sin efecto los valores impugnados.",
      marked: false,
    },
  ],
};

const GENERIC: Paragraph[] = [
  {
    text: "Que, asimismo, la recurrente presentó la documentación sustentatoria solicitada mediante requerimiento…",
    marked: false,
  },
  {
    text: "Que, de la revisión de los papeles de trabajo se verifica el procedimiento seguido por la Administración…",
    marked: false,
  },
  {
    text: "Que en esta página no aparece el criterio buscado.",
    marked: false,
  },
];

const RAIL = [1, 2, 3, 4, 5, 6, 7, 8];

export function LandingSheet() {
  const [page, setPage] = useState(7);
  const paragraphs = PAGES[page] ?? GENERIC;
  const hit = Boolean(PAGES[page]);

  return (
    <div className="pliego-wrap">
      <div className="pliego" aria-label="Ejemplo de resolución con el criterio ubicado">
        <div className="riel" role="group" aria-label="Páginas del documento">
          <span className="t">PÁG.</span>
          {RAIL.map((number) => (
            <button
              key={number}
              type="button"
              className={PAGES[number] ? "hit" : undefined}
              aria-pressed={page === number}
              onClick={() => setPage(number)}
            >
              {number}
            </button>
          ))}
        </div>
        <div className="hoja">
          <div className="hoja-cab">
            <span className="exp">
              EXPEDIENTE: <b>2019_5_11125</b>
            </span>
            <span className={hit ? "pag-aviso" : "pag-aviso fuera"}>
              {hit ? `Página ${page} — aquí aparece el criterio` : `Página ${page}`}
            </span>
          </div>
          <div>
            {paragraphs.map((paragraph) => (
              <SheetParagraph key={paragraph.text} paragraph={paragraph} />
            ))}
          </div>
        </div>
      </div>
      <div className="sello" aria-hidden="true">
        <div>
          Criterio<strong>3 pág.</strong>ubicado
        </div>
      </div>
    </div>
  );
}

function SheetParagraph({ paragraph }: { paragraph: Paragraph }) {
  if (!paragraph.marked) return <p className="tenue">{paragraph.text}</p>;
  const index = paragraph.text.indexOf(MARK);
  if (index < 0) return <p>{paragraph.text}</p>;
  return (
    <p>
      {paragraph.text.slice(0, index)}
      <mark>{MARK}</mark>
      {paragraph.text.slice(index + MARK.length)}
    </p>
  );
}
