"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { searchAction } from "@/app/actions";
import { initialSearchState, type ActionState } from "@/app/action-types";
import type { SearchSuccess } from "@/lib/official-search";
import type { RtfAccess } from "@/lib/plans";
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

function advancedFilled(query: Pick<SearchQuery, "todas" | "sin" | "cerca" | "filtrarFecha">): boolean {
  return Boolean(query.todas || query.sin || query.cerca || query.filtrarFecha);
}

export function SearchApp({
  rtf,
  initialQuery = "",
  initialState = initialSearchState,
}: {
  rtf: RtfAccess;
  initialQuery?: string;
  initialState?: ActionState;
}) {
  const [state, formAction, pending] = useActionState(searchAction, initialState);
  const history = useSyncExternalStore(subscribe, readEntries, () => emptyEntries);
  const storageError = useSyncExternalStore(subscribe, readSaveError, () => "");
  const [reopened, setReopened] = useState<HistoryEntry | null>(null);
  const [exacta, setExacta] = useState(initialState.query?.exacta || initialQuery);
  const [todas, setTodas] = useState("");
  const [sin, setSin] = useState("");
  const [cerca, setCerca] = useState("");
  const [max, setMax] = useState("20");
  const [alcance, setAlcance] = useState<"sumilla" | "completo">("sumilla");
  const [filtrarFecha, setFiltrarFecha] = useState(false);
  const [fechaBegin, setFechaBegin] = useState("01/01/1964");
  const [fechaHasta, setFechaHasta] = useState(todayInLima);
  const [advanced, setAdvanced] = useState(false);

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
    setAdvanced(advancedFilled(query));
  }

  function reopen(entry: HistoryEntry) {
    fill(entry.query);
    setReopened(entry);
  }

  return (
    <main className="envoltura">
      <div className="app-cab">
        <span className="rotulo">Buscar jurisprudencia</span>
        <h1>Jurisprudencia del Tribunal Fiscal</h1>
        <p>
          Arma la búsqueda con el idioma del formulario oficial y muestra la sumilla junto al
          identificador. El PDF se abre en el MEF. Esta página no es el sitio del Tribunal y no
          guarda una copia de las resoluciones.
        </p>
      </div>

      <div className="app-grid">
        <div>
          <form
            action={formAction}
            onSubmit={() => setReopened(null)}
            className="panel"
            role="search"
          >
            <input type="hidden" name="paso" value="buscar" />
            <div className="fila-busca">
              <div className="campo">
                <label htmlFor="exacta">Tema o frase exacta</label>
                <input
                  id="exacta"
                  name="exacta"
                  value={exacta}
                  onChange={(event) => setExacta(event.target.value)}
                  className="inp inp-grande"
                  placeholder="contrato de estabilidad"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn btn-primario" disabled={pending}>
                {pending ? "Buscando en el MEF…" : "Buscar"}
              </button>
            </div>
            <div className="donde" role="radiogroup" aria-label="Dónde buscar">
              <label className="chip-radio">
                <input
                  type="radio"
                  name="alcance"
                  value="sumilla"
                  checked={alcance === "sumilla"}
                  onChange={() => setAlcance("sumilla")}
                />
                <span>Sumilla, desde 2000</span>
              </label>
              <label className="chip-radio">
                <input
                  type="radio"
                  name="alcance"
                  value="completo"
                  checked={alcance === "completo"}
                  onChange={() => setAlcance("completo")}
                />
                <span>Texto completo, desde 1964</span>
              </label>
            </div>
            <details
              className="avanzada"
              open={advanced}
              onToggle={(event) => setAdvanced(event.currentTarget.open)}
            >
              <summary>Búsqueda avanzada</summary>
              <div className="av-grid">
                <div className="campo">
                  <label htmlFor="todas">Palabras que deben estar</label>
                  <input
                    id="todas"
                    name="todas"
                    value={todas}
                    onChange={(event) => setTodas(event.target.value)}
                    className="inp"
                    placeholder="Todas, en cualquier orden"
                    autoComplete="off"
                  />
                </div>
                <div className="campo">
                  <label htmlFor="sin">Palabras que no deben estar</label>
                  <input
                    id="sin"
                    name="sin"
                    value={sin}
                    onChange={(event) => setSin(event.target.value)}
                    className="inp"
                    placeholder="Ninguna de estas"
                    autoComplete="off"
                  />
                </div>
                <div className="campo ancho">
                  <span className="lbl">Palabras cercanas</span>
                  <div className="cercanas">
                    <input
                      name="cerca"
                      value={cerca}
                      onChange={(event) => setCerca(event.target.value)}
                      className="inp"
                      aria-label="Palabras cercanas"
                      autoComplete="off"
                    />
                    <input
                      name="max"
                      inputMode="numeric"
                      value={max}
                      onChange={(event) => setMax(event.target.value)}
                      className="inp"
                      aria-label="Ventana"
                      aria-describedby="ventana-ayuda"
                    />
                  </div>
                  <p id="ventana-ayuda" className="ayuda">
                    Si escribes palabras cercanas, tienen que aparecer dentro de esa cantidad de palabras.
                    El sitio parte en 20.
                  </p>
                </div>
                <div className="fechas">
                  <label className="tog">
                    <input
                      type="checkbox"
                      name="filtrarFecha"
                      value="on"
                      checked={filtrarFecha}
                      onChange={(event) => setFiltrarFecha(event.target.checked)}
                    />
                    Filtrar por fecha
                  </label>
                  <div className="rango">
                    <div className="campo">
                      <label htmlFor="fechaBegin">Desde</label>
                      <input
                        id="fechaBegin"
                        name="fechaBegin"
                        value={fechaBegin}
                        onChange={(event) => setFechaBegin(event.target.value)}
                        disabled={!filtrarFecha}
                        className="inp"
                        placeholder="dd/mm/aaaa"
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor="fechaEnd">Hasta</label>
                      <input
                        id="fechaEnd"
                        name="fechaEnd"
                        value={fechaHasta}
                        onChange={(event) => setFechaHasta(event.target.value)}
                        disabled={!filtrarFecha}
                        className="inp"
                        placeholder="dd/mm/aaaa"
                      />
                    </div>
                  </div>
                  <p className="ayuda">
                    Apagado, no se envían fechas. El formulario oficial trae escrito 01/01/2007 como fecha
                    final; esa fecha solo se manda si activas el filtro y la dejas así.
                  </p>
                </div>
              </div>
            </details>
          </form>

          <section aria-live="polite">
            {pending ? (
              <p className="aviso" style={{ marginTop: "1.25rem" }}>
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
                rtf={rtf}
              />
            ) : null}
          </section>
        </div>

        <HistoryList entries={history} onOpen={reopen} saveError={storageError} />
      </div>
    </main>
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
    <aside className="panel historial" aria-label="Historial">
      <h2>Historial</h2>
      <p className="nota">Queda en este navegador. Reabrir no vuelve a consultar el MEF.</p>
      {saveError ? <p className="reabierta">{saveError}</p> : null}
      {entries.length === 0 ? (
        <p className="nota">Todavía no hay búsquedas guardadas.</p>
      ) : (
        entries.map((entry) => (
          <button key={entry.id} type="button" className="hist-item" onClick={() => onOpen(entry)}>
            <b>{entry.label}</b>
            <small>
              {entry.result.total} resultados · {formatWhen(entry.savedAt)}
              {entry.result.count > 0 ? ` · desde el ${entry.result.from}` : ""}
            </small>
          </button>
        ))
      )}
    </aside>
  );
}

function Results({
  view,
  pending,
  formAction,
  onPaging,
  rtf,
}: {
  view: { query: SearchQuery; result: SearchSuccess; saved: boolean };
  pending: boolean;
  formAction: (payload: FormData) => void;
  onPaging: () => void;
  rtf: RtfAccess;
}) {
  const { query, result, saved } = view;
  const range =
    result.total === 0 ? "Sin resultados" : `${result.from}–${result.to} de ${result.total}`;

  return (
    <div>
      <div className="res-cab">
        <div>
          <div className="k">La búsqueda devolvió</div>
          <div className="n">
            {result.total === 0 ? (
              "Sin resultados"
            ) : (
              <>
                {result.total} resultados <em>· {range}</em>
              </>
            )}
          </div>
          <p className="k">El sitio oficial muestra cinco por página.</p>
        </div>
        <a href={result.officialUrl} target="_blank" rel="noreferrer">
          Ver esta búsqueda en el MEF
        </a>
      </div>
      {saved ? (
        <p className="reabierta">
          Reabierta desde el historial de este navegador. No se volvió a consultar el MEF.
        </p>
      ) : null}
      {result.refine ? (
        <p className="aviso-afina" role="status">
          Hay más de 50 resultados. Afina la frase, las palabras o el alcance antes de seguir. No hay
          página siguiente hasta que el total baje de ese umbral.
        </p>
      ) : null}
      {result.extraRows ? (
        <p className="f-meta" style={{ margin: "0.75rem 0" }}>
          La página traía más de cinco filas. Solo se leyeron las cinco primeras.
        </p>
      ) : null}

      {result.results.length === 0 ? (
        <p className="f-meta">No hubo resoluciones con ese criterio.</p>
      ) : (
        <div className="lista-fichas">
          {result.results.map((item) => (
            <article key={`${item.id}-${item.sumillaUrl}`} className="ficha">
              <div className="f-cab">
                <div>
                  <span className="exp">
                    EXPEDIENTE: <b>{item.id}</b>
                  </span>
                </div>
                {item.fichaUrl ? (
                  <a className="btn btn-secundario btn-chico" href={item.fichaUrl} target="_blank" rel="noreferrer">
                    Ficha y PDF en el MEF
                  </a>
                ) : (
                  <span className="f-meta">Sin enlace de ficha legible</span>
                )}
              </div>
              <div className="f-sum">
                {item.sumillaTitle || item.sumillaText ? (
                  <>
                    {item.sumillaTitle ? <h3>{item.sumillaTitle}</h3> : null}
                    {item.sumillaText ? <p>{item.sumillaText}</p> : null}
                  </>
                ) : (
                  <>
                    <h3>No pude leer la sumilla</h3>
                    <p>
                      {item.sumillaUrl ? (
                        <a href={item.sumillaUrl} target="_blank" rel="noreferrer">
                          Ábrela en el MEF
                        </a>
                      ) : null}
                    </p>
                  </>
                )}
              </div>
              <PdfTranscript item={item} query={query} rtf={rtf} />
            </article>
          ))}
        </div>
      )}

      {result.nextCount !== null ? (
        <div className="siguiente">
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
            <button type="submit" className="btn btn-secundario" disabled={pending}>
              Siguiente
            </button>
          </form>
          <p>Siguiente pide otra página solo si lo pulsas. No se adelanta sola.</p>
        </div>
      ) : null}
    </div>
  );
}

function PdfTranscript({
  item,
  query,
  rtf,
}: {
  item: SearchSuccess["results"][number];
  query: SearchQuery;
  rtf: RtfAccess;
}) {
  if (!item.pdfPath) return null;
  const href = lecturaHref(item, query);

  return (
    <div className="f-pie">
      {rtf.allowed ? (
        <a className="btn btn-secundario btn-chico" href={href} target="_blank" rel="noreferrer">
          Abrir RTF editable
        </a>
      ) : (
        <span className="btn-bloq" aria-disabled="true">
          Abrir RTF editable
        </span>
      )}
      {rtf.allowed && rtf.remaining !== null ? (
        <p className="f-msg">Te quedan {rtf.remaining} consultas al RTF editable este mes.</p>
      ) : null}
      {!rtf.allowed ? (
        <p className="f-msg">
          {rtf.note} <a href="/portal">Ir al portal</a>
        </p>
      ) : null}
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
    <div className="aviso-error" role="alert" style={{ marginTop: "1.25rem" }}>
      <p style={{ margin: 0 }}>{message}</p>
      {officialUrl ? (
        <p style={{ margin: "0.5rem 0 0" }}>
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
