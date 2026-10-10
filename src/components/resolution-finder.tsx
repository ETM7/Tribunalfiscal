"use client";

import { useEffect, useState, type FormEvent } from "react";
import { phraseSpans } from "@/lib/text-search";

const ARTICLE_ID = "texto-resolucion";

type Piece = { node: Text; start: number };

export function ResolutionFinder({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const marks = show(initialQuery, 0, false);
    return () => {
      const root = document.getElementById(ARTICLE_ID);
      if (root) clearSearchMarks(root);
      else marks.forEach((mark) => mark.replaceWith(...mark.childNodes));
    };
    // La frase inicial se busca una vez, cuando el texto ya está en la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function show(nextQuery: string, nextIndex: number, smooth: boolean): HTMLElement[] {
    const root = document.getElementById(ARTICLE_ID);
    if (!root) {
      setTotal(0);
      setAt(0);
      return [];
    }
    clearSearchMarks(root);
    const { text, pieces } = collect(root);
    const ranges = phraseSpans(text, nextQuery)
      .map((span) => rangeFor(pieces, span.start, span.end))
      .filter((range): range is Range => Boolean(range));
    const index = ranges.length === 0 ? 0 : ((nextIndex % ranges.length) + ranges.length) % ranges.length;
    const groups = wrapMatches(ranges);
    const current = groups[index] ?? [];
    for (const mark of current) mark.classList.add("rtf-actual");
    current[0]?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    setTotal(ranges.length);
    setAt(ranges.length === 0 ? 0 : index);
    return current;
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

function clearSearchMarks(root: HTMLElement) {
  for (const mark of root.querySelectorAll("mark.rtf-hit")) {
    mark.replaceWith(...mark.childNodes);
  }
  root.normalize();
}

function wrapMatches(ranges: Range[]): HTMLElement[][] {
  const groups: HTMLElement[][] = [];
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const slices = textSlices(ranges[index]);
    const marks: HTMLElement[] = [];
    for (let sliceIndex = slices.length - 1; sliceIndex >= 0; sliceIndex -= 1) {
      const mark = document.createElement("mark");
      mark.className = "rtf-hit";
      slices[sliceIndex].surroundContents(mark);
      marks.push(mark);
    }
    marks.reverse();
    groups.push(marks);
  }
  groups.reverse();
  return groups;
}

function textSlices(range: Range): Range[] {
  if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
    return [range];
  }
  const slices: Range[] = [];
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue && range.intersectsNode(node)) {
      const slice = document.createRange();
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;
      if (end > start) {
        slice.setStart(node, start);
        slice.setEnd(node, end);
        slices.push(slice);
      }
    }
    node = walker.nextNode();
  }
  return slices;
}
