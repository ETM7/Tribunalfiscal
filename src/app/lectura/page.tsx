import { EditableFileActions } from "@/components/editable-file";
import { consumeRtf, releaseRtf } from "@/lib/accounts";
import { currentUser } from "@/lib/session";
import { parseTranscriptRequest, prepareTranscript } from "@/lib/transcript";
import type { CriterionHit } from "@/lib/pdf-text";

export const runtime = "nodejs";
export const maxDuration = 120;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LecturaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const fields = {
    id: first(params.id),
    pdfPath: first(params.pdfPath),
    exacta: first(params.exacta),
    todas: first(params.todas),
    cerca: first(params.cerca),
    sumillaUrl: first(params.sumillaUrl),
  };
  if (!fields.id && !fields.pdfPath) {
    return <EmptyLector />;
  }
  const parsed = parseTranscriptRequest(fields);
  if (!parsed.ok) {
    return <Notice message={parsed.message} />;
  }

  const viewer = await currentUser();
  const gate = await consumeRtf(viewer?.id ?? null, parsed.request.id);
  if (!gate.ok) {
    return <Notice message={gate.message} actionHref="/portal" actionLabel="Ir al portal" />;
  }

  try {
    const ready = await prepareTranscript(parsed.request);
    const marked = new Set(ready.hits.flatMap((hit) => hit.pages));
    const total = ready.pages.length;
    return (
      <main className="envoltura ancha">
        <div className="app-cab lector-cab">
          <div>
            <span className="rotulo">Lectura</span>
            <h1>
              EXPEDIENTE: <b>{ready.id}</b>
            </h1>
            <p>Usa Control+F o Buscar en esta página. Puedes corregir el texto y descargarlo.</p>
          </div>
          <a href="/">← Volver a la búsqueda</a>
        </div>

        <div className="lector">
          <aside className="costado">
            <div className="panel">
              <h2>Dónde aparece el criterio</h2>
              <Criteria hits={ready.hits} />
              <p className="aviso-20">
                {ready.truncated
                  ? "Solo se leyeron las primeras 20 páginas."
                  : `Se leyeron las ${total} páginas del PDF.`}
              </p>
            </div>
            <div className="panel">
              <div className="acciones">
                <EditableFileActions filename={ready.filename} />
              </div>
              <div className="enlaces-mef">
                {ready.sumillaUrl ? (
                  <a href={ready.sumillaUrl} target="_blank" rel="noreferrer">
                    Sumilla oficial
                  </a>
                ) : (
                  <span>Sumilla oficial no disponible</span>
                )}
                <span>La sumilla no es una página de este PDF.</span>
                <a href={ready.pdfUrl} target="_blank" rel="noreferrer">
                  PDF de origen en el MEF
                </a>
              </div>
              {gate.remaining !== null ? (
                <p className="estado-sesion cupo-lector">
                  Te quedan <b>{gate.remaining}</b> consultas al RTF editable este mes.
                </p>
              ) : null}
            </div>
          </aside>

          <div>
            <div id="documento-resolucion">
              <details className="resumen">
                <summary>
                  <span className="btn btn-secundario">Resumen del PDF</span>
                </summary>
                <div className="cuerpo">
                  <small>Parte resolutiva del PDF. No es la sumilla del MEF.</small>
                  <p>{ready.resumen}</p>
                </div>
              </details>
              <div className="solo-descarga">
                <h2>Dónde aparece el criterio</h2>
                <ul>
                  {ready.hits.length === 0 ? <li>No había frase ni palabras para marcar.</li> : null}
                  {ready.hits.map((hit) => (
                    <li key={hit.label}>
                      {hit.label}: {hit.pages.length ? `páginas ${hit.pages.join(", ")}` : "no aparece"}.
                    </li>
                  ))}
                </ul>
                {ready.truncated ? <p>Solo se leyeron las primeras 20 páginas.</p> : null}
              </div>
              <article id="texto-resolucion" contentEditable suppressContentEditableWarning className="doc-editable">
                {ready.pages.map((page) => (
                  <section key={page.page} id={`p-${page.page}`} className="pagina">
                    <h2>
                      Página {page.page}
                      {marked.has(page.page) ? " — aquí aparece el criterio" : ""}
                    </h2>
                    <span className="num">
                      {page.page} / {total}
                    </span>
                    {page.headerImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={`Encabezado de la página ${page.page}`} src={page.headerImage} />
                    ) : null}
                    {page.blocks.map((block, index) =>
                      block.type === "table" ? (
                        <figure key={`${page.page}-tabla-${index}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={`Tabla de la página ${page.page}`} src={block.image} />
                          <details className="tabla-txt">
                            <summary>Texto de esta tabla para Buscar</summary>
                            <p>{block.text}</p>
                          </details>
                        </figure>
                      ) : (
                        <p key={`${page.page}-p-${index}`}>{block.text}</p>
                      ),
                    )}
                  </section>
                ))}
                {ready.signatureImage ? (
                  <section className="pagina firmas">
                    <h2>Firmas</h2>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Firmas del final del PDF" src={ready.signatureImage} />
                  </section>
                ) : null}
              </article>
            </div>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    if (gate.counted && viewer) await releaseRtf(viewer.id, parsed.request.id);
    const message = error instanceof Error ? error.message : "No pude leer las páginas del PDF. Ábrelo en el MEF.";
    return <Notice message={message} />;
  }
}

function Criteria({ hits }: { hits: CriterionHit[] }) {
  if (hits.length === 0) {
    return <p className="f-meta">No había frase ni palabras para marcar.</p>;
  }
  return (
    <ul className="criterios">
      {hits.map((hit) => (
        <li key={hit.label}>
          <span className="q">{hit.label}</span>
          {hit.pages.length ? (
            <span className="pags">
              {hit.pages.map((page) => (
                <a key={page} href={`#p-${page}`}>
                  <span className="pgn">{page}</span>
                </a>
              ))}
            </span>
          ) : (
            <span className="f-meta">no aparece</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function EmptyLector() {
  return (
    <main className="envoltura">
      <div className="app-cab">
        <span className="rotulo">Lector</span>
        <h1>Lector</h1>
        <p>Abre una resolución desde Buscar.</p>
        <p style={{ marginTop: "0.9rem" }}>
          <a href="/">Ir a Buscar</a>
        </p>
      </div>
    </main>
  );
}

function Notice({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <main className="envoltura">
      <div className="app-cab">
        <span className="rotulo">Lectura</span>
        <p className="aviso-error" role="alert">
          {message}
        </p>
        {actionHref && actionLabel ? (
          <p style={{ marginTop: "0.9rem" }}>
            <a href={actionHref}>{actionLabel}</a>
          </p>
        ) : null}
        <p style={{ marginTop: "0.9rem" }}>
          <a href="/">Volver a la búsqueda</a>
        </p>
      </div>
    </main>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}
