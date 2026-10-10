export const runtime = "nodejs";

export default function ContactoPage() {
  return (
    <main className="envoltura">
      <div className="app-cab">
        <span className="rotulo">Contacto</span>
        <h1>La cuenta se atiende desde el portal.</h1>
        <p>
          Para cambiar tus datos, la contraseña o el plan, entra al portal. Un plan de pago queda pendiente hasta que
          administración confirma el pago. No hay un cobro automático con la tarjeta guardada.
        </p>
        <p>
          <a href="/portal">Ir al portal</a>
        </p>
      </div>
    </main>
  );
}
