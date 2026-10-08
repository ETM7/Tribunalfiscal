export default function LoadingLectura() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--seal)] uppercase">Texto editable</p>
      <h1 className="mt-2 font-serif text-4xl">Leyendo las páginas del PDF…</h1>
      <p className="mt-3 text-base leading-7 text-[var(--muted)]">
        El archivo del MEF está escaneado. Esta página arma el texto para que puedas usar Buscar y descargarlo.
      </p>
    </main>
  );
}
