"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { searchAction } from "@/app/actions";
import { initialSearchState } from "@/app/action-types";
import type { SearchSuccess } from "@/lib/official-search";
import {
  queryLabel,
  todayInLima,
  type SearchQuery,
} from "@/lib/search-query";

const HISTORY_KEY = "tf-jurisprudencia:v1";
const HISTORY_LIMIT = 8;

type HistoryEntry = {
  id: string;
  savedAt: number;
  label: string;
  query: SearchQuery;
  result: SearchSuccess;
};

const listeners = new Set<() => void>();
let cacheRaw = "";
let cacheEntries: HistoryEntry[] = [];
let saveError = "";
const emptyEntries: HistoryEntry[] = [];

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readEntries(): HistoryEntry[] {
  const raw = window.localStorage.getItem(HISTORY_KEY) || "[]";
  if (raw === cacheRaw) return cacheEntries;
  cacheRaw = raw;
  cacheEntries = parseEntries(raw);
  return cacheEntries;
}

function parseEntries(raw: string): HistoryEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as HistoryEntry;
  return typeof entry.id === "string" && typeof entry.label === "string" && Boolean(entry.query) && Boolean(entry.result);
}

function writeEntries(entries: HistoryEntry[]) {
  const raw = JSON.stringify(entries.slice(0, HISTORY_LIMIT));
  window.localStorage.setItem(HISTORY_KEY, raw);
  cacheRaw = raw;
  cacheEntries = entries.slice(0, HISTORY_LIMIT);
  listeners.forEach((listener) => listener());
}

function readSaveError() {
  return saveError;
}

function remember(query: SearchQuery, result: SearchSuccess) {
  const entry: HistoryEntry = {
    id: `${result.count}:${queryLabel(query)}:${Date.now()}`,
    savedAt: Date.now(),
    label: queryLabel(query),
    query,
    result,
  };
  const signature = JSON.stringify({ query, count: result.count });
  const next = [
    entry,
    ...readEntries().filter((item) => JSON.stringify({ query: item.query, count: item.result.count }) !== signature),
  ];
  writeEntries(next);
  if (saveError) {
    saveError = "";
    listeners.forEach((listener) => listener());
  }
}

export function SearchApp() {
  const [state, formAction, pending] = useActionState(searchAction, initialSearchState);
  const history = useSyncExternalStore(subscribe, readEntries, () => emptyEntries);
  const storageError = useSyncExternalStore(subscribe, readSaveError, () => "");
  const [reopened, setReopened] = useState<HistoryEntry | null>(null);
  const [exacta, setExacta] = useState("");
  const [todas, setTodas] = useState("");
  const [sin, setSin] = useState("");
  const [cerca, setCerca] = useState("");
  const [max, setMax] = useState("20");
  const [alcance, setAlcance] = useState<"sumilla" | "completo">("sumilla");
  const [filtrarFecha, setFiltrarFecha] = useState(false);
  const [fechaBegin, setFechaBegin] = useState("01/01/1964");
  const [fechaHasta, setFechaHasta] = useState(todayInLima);

  useEffect(() => {
    if (state.status !== "ok" || !state.query || !state.result) return;
    try {
      remember(state.query, state.result);
    } catch (error) {
      saveError = error instanceof Error ? error.message : "No se pudo guardar el historial.";
      listeners.forEach((listener) => listener());
    }
  }, [state]);

  const visible: { query: SearchQuery; result: SearchSuccess; saved: boolean } | null = reopened
    ? { query: reopened.query, result: reopened.result, saved: true }
    : state.status === "ok" && state.query && state.result
      ? { query: state.query, result: state.result, saved: false }
      : null;

  function fill(query: SearchQuery) {
    setExacta(query.exacta);
    setTodas(query.todas);
    setSin(query.sin);
    setCerca(query.cerca);
    setMax(String(query.max || 20));
    setAlcance(query.alcance);
    setFiltrarFecha(query.filtrarFecha);
    setFechaBegin(query.fechaBegin || "01/01/1964");
    setFechaHasta(query.fechaEnd || todayInLima());
  }

  function reopen(entry: HistoryEntry) {
    fill(entry.query);
    setReopened(entry);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="border-b border-[var(--line)] pb-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-[var(--seal)] uppercase">
          Consulta en vivo
        </p>
        <h1 className="mt-2 font-serif text-4xl text-[var(--ink)]">Jurisprudencia del Tribunal Fiscal</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Arma la búsqueda con el idioma del formulario oficial y muestra la sumilla junto al
          identificador. El PDF se abre en el MEF. Esta página no es el sitio del Tribunal y no
          guarda una copia de las resoluciones.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form
          action={formAction}
          onSubmit={() => setReopened(null)}
          className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-sm"
        >
          <input type="hidden" name="paso" value="buscar" />
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-[var(--ink)]">Tema o frase exacta</span>
              <input
                name="exacta"
                value={exacta}
                onChange={(event) => setExacta(event.target.value)}
                className="field"
                placeholder="contrato de estabilidad"
                autoComplete="off"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-[var(--ink)]">Palabras que deben estar</span>
              <input
                name="todas"
                value={todas}
                onChange={(event) => setTodas(event.target.value)}
                className="field"
                placeholder="Todas, en cualquier orden"
                autoComplete="off"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-[var(--ink)]">Palabras que no deben estar</span>
              <input
                name="sin"
                value={sin}
                onChange={(event) => setSin(event.target.value)}
                className="field"
                autoComplete="off"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold text-[var(--ink)]">Palabras cercanas</span>
                <input
                  name="cerca"
                  value={cerca}
                  onChange={(event) => setCerca(event.target.value)}
                  className="field"
                  autoComplete="off"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold text-[var(--ink)]">Ventana</span>
                <input
                  name="max"
                  inputMode="numeric"
                  value={max}
                  onChange={(event) => setMax(event.target.value)}
                  className="field"
                  aria-describedby="ventana-ayuda"
                />
              </label>
            </div>
            <p id="ventana-ayuda" className="text-sm text-[var(--muted)]">
              Si escribes palabras cercanas, tienen que aparecer dentro de esa cantidad de palabras.
              El sitio parte en 20.
            </p>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold text-[var(--ink)]">Dónde buscar</legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="alcance"
                  value="sumilla"
                  checked={alcance === "sumilla"}
                  onChange={() => setAlcance("sumilla")}
                />
                <span>Sumilla, desde 2000</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="alcance"
                  value="completo"
                  checked={alcance === "completo"}
                  onChange={() => setAlcance("completo")}
                />
                <span>Texto completo de la resolución, desde 1964</span>
              </label>
            </fieldset>
            <fieldset className="grid gap-3 rounded-xl bg-[var(--wash)] p-3">
              <label className="flex items-start gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  name="filtrarFecha"
                  value="on"
                  checked={filtrarFecha}
                  onChange={(event) => setFiltrarFecha(event.target.checked)}
                />
                <span>Filtrar por fecha</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Desde
                  <input
                    name="fechaBegin"
                    value={fechaBegin}
                    onChange={(event) => setFechaBegin(event.target.value)}
                    disabled={!filtrarFecha}
                    className="field"
                    placeholder="dd/mm/aaaa"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Hasta
                  <input
                    name="fechaEnd"
                    value={fechaHasta}
                    onChange={(event) => setFechaHasta(event.target.value)}
                    disabled={!filtrarFecha}
                    className="field"
                    placeholder="dd/mm/aaaa"
                  />
                </label>
              </div>
              <p className="text-sm text-[var(--muted)]">
                Apagado, no se envían fechas. El formulario oficial trae escrito 01/01/2007 como fecha
                final; esa fecha solo se manda si activas el filtro y la dejas así.
              </p>
            </fieldset>
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Buscando en el MEF…" : "Buscar"}
            </button>
          </div>
        </form>

        <HistoryList entries={history} onOpen={reopen} saveError={storageError} />
      </div>

      <section aria-live="polite" className="grid gap-4">
        {pending ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm">
            Una búsqueda a la vez. Leyendo la página pedida y, después, la sumilla de cada resultado.
          </p>
        ) : null}
        {!pending && state.status === "error" && !reopened ? (
          <ErrorNote message={state.message} officialUrl={state.officialUrl} />
        ) : null}
        {visible ? (
          <Results
            view={visible}
            pending={pending}
            formAction={formAction}
            onPaging={() => setReopened(null)}
          />
        ) : null}
      </section>
    </div>
  );
}

function HistoryList({
  entries,
  onOpen,
  saveError,
}: {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  saveError: string;
}) {
  return (
    <aside className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <h2 className="font-serif text-xl text-[var(--ink)]">Historial</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        Queda en este navegador. Reabrir no vuelve a consultar el MEF.
      </p>
      {saveError ? <p className="mt-3 text-sm text-[var(--seal)]">{saveError}</p> : null}
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Todavía no hay búsquedas guardadas.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="history" onClick={() => onOpen(entry)}>
                <span className="block font-semibold">{entry.label}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {entry.result.total} resultados · {formatWhen(entry.savedAt)}
                  {entry.result.count > 0 ? ` · desde el ${entry.result.from}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Results({
  view,
  pending,
  formAction,
  onPaging,
}: {
  view: { query: SearchQuery; result: SearchSuccess; saved: boolean };
  pending: boolean;
  formAction: (payload: FormData) => void;
  onPaging: () => void;
}) {
  const { query, result, saved } = view;
  const range =
    result.total === 0 ? "Sin resultados" : `${result.from}–${result.to} de ${result.total}`;

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <p className="text-sm text-[var(--muted)]">La búsqueda devolvió</p>
        <p className="font-serif text-3xl text-[var(--ink)]">
          {result.total} <span className="text-xl">resultados</span>
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {range}. El sitio oficial muestra cinco por página.
        </p>
        {saved ? (
          <p className="mt-3 text-sm text-[var(--seal)]">
            Reabierta desde el historial de este navegador. No se volvió a consultar el MEF.
          </p>
        ) : null}
        {result.refine ? (
          <p className="mt-3 rounded-xl bg-[#f8e8e4] px-3 py-2 text-sm text-[#6d241c]" role="status">
            Hay más de 50 resultados. Afina la frase, las palabras o el alcance antes de seguir. No
            hay página siguiente hasta que el total baje de ese umbral.
          </p>
        ) : null}
        {result.extraRows ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            La página traía más de cinco filas. Solo se leyeron las cinco primeras.
          </p>
        ) : null}
        <p className="mt-3 text-sm">
          <a href={result.officialUrl} target="_blank" rel="noreferrer">
            Abrir esta página en el buscador oficial
          </a>
        </p>
        {result.nextCount !== null ? (
          <form action={formAction} onSubmit={onPaging}>
            <input type="hidden" name="paso" value="siguiente" />
            <input type="hidden" name="count" value={result.nextCount} />
            <input type="hidden" name="exacta" value={query.exacta} />
            <input type="hidden" name="todas" value={query.todas} />
            <input type="hidden" name="sin" value={query.sin} />
            <input type="hidden" name="cerca" value={query.cerca} />
            <input type="hidden" name="max" value={query.max} />
            <input type="hidden" name="alcance" value={query.alcance} />
            {query.filtrarFecha ? (
              <>
                <input type="hidden" name="filtrarFecha" value="on" />
                <input type="hidden" name="fechaBegin" value={query.fechaBegin} />
                <input type="hidden" name="fechaEnd" value={query.fechaEnd} />
              </>
            ) : null}
            <button type="submit" className="secondary mt-4" disabled={pending}>
              Siguiente
            </button>
          </form>
        ) : null}
        {result.nextCount !== null ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Siguiente pide otra página solo si lo pulsas. No se adelanta sola.
          </p>
        ) : null}
      </div>

      {result.results.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No hubo resoluciones con ese criterio.</p>
      ) : (
        <ol className="grid gap-3">
          {result.results.map((item) => (
            <li key={`${item.id}-${item.sumillaUrl}`} className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-mono text-lg text-[var(--ink)]">{item.id}</h3>
                {item.fichaUrl ? (
                  <a href={item.fichaUrl} target="_blank" rel="noreferrer">
                    Ficha y PDF en el MEF
                  </a>
                ) : (
                  <span className="text-sm text-[var(--muted)]">Sin enlace de ficha legible</span>
                )}
              </div>
              {item.sumillaTitle || item.sumillaText ? (
                <div className="mt-3">
                  {item.sumillaTitle ? <p className="text-sm font-semibold">{item.sumillaTitle}</p> : null}
                  {item.sumillaText ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{item.sumillaText}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  No pude leer la sumilla.{" "}
                  {item.sumillaUrl ? (
                    <a href={item.sumillaUrl} target="_blank" rel="noreferrer">
                      Ábrela en el MEF
                    </a>
                  ) : null}
                </p>
              )}
              <PdfTranscript item={item} query={query} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PdfTranscript({
  item,
  query,
}: {
  item: SearchSuccess["results"][number];
  query: SearchQuery;
}) {
  if (!item.pdfPath) return null;
  const href = lecturaHref(item, query);

  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3">
      <p className="text-sm leading-6 text-[var(--muted)]">
        La sumilla de arriba es el resumen que publica el MEF en su propia página. No está tomada de una
        página del PDF.
        {item.sumillaUrl ? (
          <>
            {" "}
            <a href={item.sumillaUrl} target="_blank" rel="noreferrer">
              Abrir esa sumilla
            </a>
          </>
        ) : null}
      </p>
      <a className="secondary mt-3 inline-block" href={href} target="_blank" rel="noreferrer">
        Abrir texto editable
      </a>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Se abre en el navegador, con el texto justificado, el encabezado y las firmas. Ahí está el botón
        Resumen del PDF y la descarga.
      </p>
    </div>
  );
}

function lecturaHref(item: SearchSuccess["results"][number], query: SearchQuery): string {
  const params = new URLSearchParams({
    id: item.id,
    pdfPath: item.pdfPath,
    exacta: query.exacta,
    todas: query.todas,
    cerca: query.cerca,
  });
  if (item.sumillaUrl) params.set("sumillaUrl", item.sumillaUrl);
  return `/lectura?${params.toString()}`;
}

function ErrorNote({ message, officialUrl }: { message: string; officialUrl: string }) {
  return (
    <div className="rounded-2xl border border-[#e4b2aa] bg-[#fbf1ee] px-4 py-3 text-sm text-[#6d241c]" role="alert">
      <p>{message}</p>
      {officialUrl ? (
        <p className="mt-2">
          <a href={officialUrl} target="_blank" rel="noreferrer">
            Abrir la búsqueda en el formulario oficial
          </a>
        </p>
      ) : null}
    </div>
  );
}

function formatWhen(stamp: number): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(stamp);
}
