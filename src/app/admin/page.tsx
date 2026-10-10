import { redirect } from "next/navigation";
import { confirmPaymentAction, createUserAction } from "@/app/admin/actions";
import { AdminPeople } from "@/components/admin-people";
import { listUsers } from "@/lib/accounts";
import { PLAN_ORDER, PLANS, priceLabel } from "@/lib/plans";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

type AdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminProps) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    redirect("/portal?aviso=" + encodeURIComponent("El panel de administrador es solo para cuentas de administración."));
  }

  const params = await searchParams;
  const aviso = first(params.aviso).slice(0, 300);
  const users = await listUsers();
  const pending = users.filter((account) => account.pendingPlan);

  return (
    <main className="envoltura">
      <div className="app-cab">
        <span className="rotulo">Administración</span>
        <h1>Cuentas y planes</h1>
        <p>
          Asigna el plan cuando el pago esté confirmado. Esta pantalla no cobra la tarjeta. El cupo
          del RTF editable se reinicia solo cada mes, en hora de Lima, o cuando lo pongas en cero.
        </p>
      </div>

      {aviso ? (
        <p className="aviso" role="status" style={{ marginBottom: "1.25rem" }}>
          {aviso}
        </p>
      ) : null}

      <nav className="admin-tabs" aria-label="Secciones">
        <a href="#pagos" className={pending.length ? "on" : undefined}>
          Pagos por confirmar <span className="cnt">{pending.length}</span>
        </a>
        <a href="#personas" className={pending.length ? undefined : "on"}>
          Personas
        </a>
        <a href="#nueva">Nueva cuenta</a>
      </nav>

      <div className="bandeja" id="pagos">
        {pending.length === 0 ? (
          <p className="panel" style={{ textAlign: "center", color: "var(--sec)" }}>
            No hay pagos por confirmar. Las nuevas solicitudes aparecerán aquí.
          </p>
        ) : (
          pending.map((account) => (
            <article key={account.id} className="pago">
              <div className="pago-info">
                <h3>{account.name}</h3>
                <div className="mail">{account.email}</div>
                <div className="cambio">
                  <span className="de">{PLANS[account.plan].name}</span>
                  <span aria-hidden="true">→</span>
                  <span className="a">{PLANS[account.pendingPlan!].name}</span>
                  <span>· {priceLabel(PLANS[account.pendingPlan!])}</span>
                </div>
              </div>
              <div className="pago-acc">
                <form action={confirmPaymentAction}>
                  <input type="hidden" name="userId" value={account.id} />
                  <button type="submit" className="btn btn-primario btn-chico">
                    Confirmar pago
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="admin-grid">
        <form action={createUserAction} className="panel" id="nueva">
          <h2 className="t2">Nueva cuenta</h2>
          <p className="sub">Para quien pagó por fuera del portal.</p>
          <div className="form-grid">
            <div className="campo">
              <label htmlFor="n-nom">Nombre</label>
              <input id="n-nom" name="nombre" required className="inp" />
            </div>
            <div className="campo">
              <label htmlFor="n-mail">Correo</label>
              <input id="n-mail" name="email" type="email" required className="inp" />
            </div>
            <div className="campo">
              <label htmlFor="n-pass">Contraseña inicial</label>
              <input id="n-pass" name="password" type="text" minLength={8} required className="inp" autoComplete="off" />
              <p className="ayuda">Queda visible para que puedas entregarla.</p>
            </div>
            <div className="campo">
              <label htmlFor="n-plan">Plan</label>
              <select id="n-plan" name="plan" className="inp" defaultValue="junior">
                {PLAN_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {PLANS[id].name} · {priceLabel(PLANS[id])}
                  </option>
                ))}
              </select>
            </div>
            <label className="check">
              <input name="rol" type="checkbox" value="admin" />
              También es administrador
            </label>
            <button type="submit" className="btn btn-primario">
              Crear cuenta
            </button>
          </div>
        </form>

        <AdminPeople users={users} />
      </div>
    </main>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}
