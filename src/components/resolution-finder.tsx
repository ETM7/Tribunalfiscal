"use client";

import { useEffect, useState, type FormEvent } from "react";
import { phraseSpans } from "@/lib/pdf-text";

const ARTICLE_ID = "texto-resolucion";

type Piece = { node: Text; start: number };

export function ResolutionFinder({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    show(initialQuery, 0, false);
    return () => paint([], -1);
    // La frase inicial se busca una vez, cuando el texto ya está en la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function show(nextQuery: string, nextIndex: number, smooth: boolean) {
    const root = document.getElementById(ARTICLE_ID);
    if (!root) {
      setTotal(0);
      setAt(0);
      paint([], -1);
      return;
    }
    const { text, pieces } = collect(root);
    const ranges = phraseSpans(text, nextQuery)
      .map((span) => rangeFor(pieces, span.start, span.end))
      .filter((range): range is Range => Boolean(range));
    const index = ranges.length === 0 ? 0 : ((nextIndex % ranges.length) + ranges.length) % ranges.length;
    paint(ranges, ranges.length === 0 ? -1 : index);
    if (ranges[index]) scrollTo(ranges[index], smooth);
    setTotal(ranges.length);
    setAt(ranges.length === 0 ? 0 : index);
  }

  function go(event: FormEvent) {
    event.preventDefault();
    show(query, 0, true);
  }

  const label = total === 0 ? "0 de 0" : `${at + 1} de ${total}`;

  return (
    <form className="panel busca-res" onSubmit={go}>
      <h2>Buscar en esta resolución</h2>
      <div className="fila">
        <label className="solo-lector" htmlFor="busca-resolucion">
          Texto a buscar en la resolución
        </label>
        <input
          id="busca-resolucion"
          className="inp"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Decisión 578"
          autoComplete="off"
        />
        <button type="submit" className="ir-redondo" aria-label="Ir a la primera coincidencia">
          Ir
        </button>
      </div>
      <div className="nav-res">
        <p className="cuenta-res" aria-live="polite">
          {label}
        </p>
        <div className="pasos">
          <button
            type="button"
            className="paso-redondo"
            aria-label="Coincidencia anterior"
            disabled={total === 0}
            onClick={() => show(query, at - 1, true)}
          >
            <Chevron direction="up" />
          </button>
          <button
            type="button"
            className="paso-redondo"
            aria-label="Coincidencia siguiente"
            disabled={total === 0}
            onClick={() => show(query, at + 1, true)}
          >
            <Chevron direction="down" />
          </button>
        </div>
      </div>
    </form>
  );
}

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      {direction === "up" ? <path d="M3 10.5 8 5.5l5 5" /> : <path d="M3 5.5 8 10.5l5-5" />}
    </svg>
  );
}

function collect(root: HTMLElement): { text: string; pieces: Piece[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const pieces: Piece[] = [];
  let text = "";
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    pieces.push({ node, start: text.length });
    text += node.data;
    current = walker.nextNode();
  }
  return { text, pieces };
}

function rangeFor(pieces: Piece[], start: number, end: number): Range | null {
  const from = pointAt(pieces, start);
  const to = pointAt(pieces, end);
  if (!from || !to) return null;
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

function pointAt(pieces: Piece[], index: number): { node: Text; offset: number } | null {
  for (let cursor = pieces.length - 1; cursor >= 0; cursor -= 1) {
    const piece = pieces[cursor];
    if (piece.start <= index && index <= piece.start + piece.node.data.length) {
      return { node: piece.node, offset: index - piece.start };
    }
  }
  return null;
}

function paint(ranges: Range[], current: number) {
  const api = CSS.highlights;
  if (!api) return;
  api.set("rtf-hit", new Highlight(...ranges));
  api.set("rtf-current", current >= 0 && ranges[current] ? new Highlight(ranges[current]) : new Highlight());
}

function scrollTo(range: Range, smooth: boolean) {
  const node = range.startContainer;
  const element = node instanceof Element ? node : node.parentElement;
  element?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
}
