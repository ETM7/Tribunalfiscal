import { EditableFileActions } from "@/components/editable-file";
import { parseTranscriptRequest, prepareTranscript } from "@/lib/transcript";

export const runtime = "nodejs";
export const maxDuration = 120;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LecturaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const parsed = parseTranscriptRequest({
    id: first(params.id),
    pdfPath: first(params.pdfPath),
    exacta: first(params.exacta),
    todas: first(params.todas),
    cerca: first(params.cerca),
    sumillaUrl: first(params.sumillaUrl),
  });
  if (!parsed.ok) {
    return <Notice message={parsed.message} />;
  }

  try {
    const ready = await prepareTranscript(parsed.request);
    const marked = new Set(ready.hits.flatMap((hit) => hit.pages));
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-[var(--seal)] uppercase">Texto editable</p>
        <h1 className="mt-2 font-serif text-4xl text-[var(--ink)]">Resolución {ready.id}</h1>
        <p className="mt-3 text-base leading-7 text-[var(--muted)]">
          Usa Control+F o Buscar en esta página. Puedes corregir el texto y descargarlo.
        </p>
        <EditableFileActions filename={ready.filename} />
        <p className="mt-4 text-sm leading-6">
          {ready.sumillaUrl ? (
            <a href={ready.sumillaUrl} target="_blank" rel="noreferrer">
              Sumilla oficial
            </a>
          ) : (
            "Sumilla oficial no disponible"
          )}
          . La sumilla no es una página de este PDF.{" "}
          <a href={ready.pdfUrl} target="_blank" rel="noreferrer">
            PDF de origen en el MEF
          </a>
        </p>
        <div id="documento-resolucion">
        <details className="resumen-pdf mt-4">
          <summary>Resumen del PDF</summary>
          <p className="resumen-cuerpo">{ready.resumen}</p>
        </details>
        <h2 className="mt-6 font-serif text-2xl">Dónde aparece el criterio</h2>
        <ul className="mt-2 list-disc pl-5 text-sm leading-6">
          {ready.hits.length === 0 ? <li>No había frase ni palabras para marcar.</li> : null}
          {ready.hits.map((hit) => (
            <li key={hit.label}>
              {hit.label}: {hit.pages.length ? `páginas ${hit.pages.join(", ")}` : "no aparece"}.
            </li>
          ))}
        </ul>
        {ready.truncated ? (
          <p className="mt-3 text-sm">Solo se leyeron las primeras 20 páginas.</p>
        ) : null}
        <article
          id="texto-resolucion"
          contentEditable
          suppressContentEditableWarning
          className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5"
        >
          {ready.pages.map((page) => (
            <section key={page.page} className="mt-10 first:mt-0">
              <h2 className="font-serif text-2xl">
                Página {page.page}
                {marked.has(page.page) ? " — aquí aparece el criterio" : ""}
              </h2>
              {page.headerImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`Encabezado de la página ${page.page}`}
                  src={page.headerImage}
                  className="mx-auto my-4 block max-w-full"
                />
              ) : null}
              {page.blocks.map((block, index) =>
                block.type === "table" ? (
                  <figure key={`${page.page}-tabla-${index}`} className="my-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`Tabla de la página ${page.page}`} src={block.image} className="mx-auto block max-w-full" />
                    <details className="mt-2 text-sm">
                      <summary>Texto de esta tabla para Buscar</summary>
                      <p className="mt-2 text-justify leading-7">{block.text}</p>
                    </details>
                  </figure>
                ) : (
                  <p key={`${page.page}-p-${index}`} className="mt-3 text-justify text-sm leading-7">
                    {block.text}
                  </p>
                )
              )}
            </section>
          ))}
          {ready.signatureImage ? (
            <figure className="mt-10">
              <h2 className="font-serif text-2xl">Firmas</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Firmas del final del PDF" src={ready.signatureImage} className="mx-auto my-4 block max-w-full" />
            </figure>
          ) : null}
        </article>
        </div>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude leer las páginas del PDF. Ábrelo en el MEF.";
    return <Notice message={message} />;
  }
}

function Notice({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="rounded-2xl border border-[#e4b2aa] bg-[#fbf1ee] px-4 py-3 text-sm text-[#6d241c]">{message}</p>
    </main>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}
