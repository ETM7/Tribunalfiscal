export const runtime = "nodejs";

export default function PrivacidadPage() {
  return (
    <main className="envoltura">
      <div className="app-cab">
        <span className="rotulo">Privacidad</span>
        <h1>Qué queda guardado en tu cuenta.</h1>
        <p>
          La cuenta guarda el nombre, el correo, el plan, las lecturas del mes y lo que escribas en Datos personales.
          La foto y el CV se guardan en el servidor y solo los ves tú, salvo que actives compartir el CV.
        </p>
        <p>
          De una tarjeta solo se guardan la marca, los últimos 4 dígitos y el vencimiento. No pedimos el número
          completo ni lo enviamos a un banco. El historial de búsquedas de esta cuenta se anota cuando buscas con la
          sesión abierta.
        </p>
      </div>
    </main>
  );
}
