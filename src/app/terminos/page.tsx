export const runtime = "nodejs";

export default function TerminosPage() {
  return (
    <main className="envoltura">
      <div className="app-cab">
        <span className="rotulo">Términos</span>
        <h1>Cómo se usa esta herramienta.</h1>
        <p>
          Tribunal Fiscal es una herramienta independiente. No es un sitio del Estado ni del Ministerio de Economía y
          Finanzas. La búsqueda consulta el formulario público del Tribunal Fiscal y muestra la sumilla que ese
          formulario devuelve.
        </p>
        <p>
          Buscar no consume lecturas. Abrir el RTF editable sí cuenta, una vez por resolución distinta en el mes de
          Lima. El plan lo activa administración cuando confirma el pago. Desde esta página no se cobra una tarjeta.
        </p>
      </div>
    </main>
  );
}
