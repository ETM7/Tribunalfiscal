import { changePasswordAction, loginAction, registerAction, requestPlanAction } from "@/app/portal/actions";
import { currentUser } from "@/lib/session";
import { PLAN_ORDER, PLANS, priceLabel, type Plan } from "@/lib/plans";

export const runtime = "nodejs";

type PortalProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalPage({ searchParams }: PortalProps) {
  const params = await searchParams;
  const aviso = first(params.aviso).slice(0, 300);
  const user = await currentUser();
  const plan = user ? PLANS[user.plan] : null;

  return (
    <main className="envoltura">
      <div className="app-cab">
        <span className="rotulo">Portal</span>
        <h1>Tu cuenta</h1>
        <p>
          Todos los planes pueden buscar. El botón Abrir RTF editable depende del plan. Aquí no se
          cobra la tarjeta: solicitas el plan y el administrador lo activa cuando confirma el pago.
        </p>
      </div>

      {aviso ? (
        <p className="aviso" role="status" style={{ marginBottom: "1.25rem" }}>
          {aviso}
        </p>
      ) : null}

      {user && plan ? (
        <section className="panel">
          <div className="cuenta">
            <div>
              <span className="rotulo">Plan actual</span>
              <div className="plan-nom">{plan.name}</div>
              <p className="quien-es">
                {user.name} · {user.email}
              </p>
              <p className="quien-es" style={{ marginTop: "0.4rem" }}>
                {plan.summary}
              </p>
            </div>
            <Cupo used={user.rtfOpens} limit={plan.rtfLimit} />
          </div>
          <p className="regla-cupo">
            Cada resolución distinta cuenta una vez. Volver a abrirla no gasta otra. El mes se cuenta en
            hora de Lima.
          </p>
          {user.pendingPlan ? (
            <div className="pendiente">
              <span className="ic" aria-hidden="true">
                …
              </span>
              <p>
                <strong>
                  Solicitaste {PLANS[user.pendingPlan].name} ({priceLabel(PLANS[user.pendingPlan])}).
                </strong>{" "}
                Sigue activo {plan.name} hasta que administración confirme el pago.
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <section id="entrar" className="portal-grid">
          <form action={loginAction} className="panel">
            <h2 className="t2">Entrar</h2>
            <p className="sub">Con el correo de tu cuenta.</p>
            <div className="form-grid">
              <div className="campo">
                <label htmlFor="login-email">Correo</label>
                <input id="login-email" name="email" type="email" autoComplete="username" required className="inp" />
              </div>
              <div className="campo">
                <label htmlFor="login-password">Contraseña</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="inp"
                />
              </div>
              <button type="submit" className="btn btn-primario">
                Entrar
              </button>
            </div>
          </form>
          <form action={registerAction} className="panel">
            <h2 className="t2">Crear cuenta Junior</h2>
            <p className="sub">Es gratis. Puedes buscar enseguida. El RTF editable se abre desde Senior.</p>
            <div className="form-grid">
              <div className="campo">
                <label htmlFor="reg-nombre">Nombre</label>
                <input id="reg-nombre" name="nombre" autoComplete="name" required className="inp" />
              </div>
              <div className="campo">
                <label htmlFor="reg-email">Correo</label>
                <input id="reg-email" name="email" type="email" autoComplete="email" required className="inp" />
              </div>
              <div className="campo">
                <label htmlFor="reg-password">Contraseña</label>
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="inp"
                />
              </div>
              <button type="submit" className="btn btn-primario">
                Crear cuenta
              </button>
            </div>
          </form>
        </section>
      )}

      <section>
        <div className="cab-sec">
          <span className="rotulo">Planes</span>
          <h2>Cambia de plan cuando lo necesites.</h2>
        </div>
        <div className="planes-p">
          {PLAN_ORDER.map((id) => {
            const item = PLANS[id];
            const current = user?.plan === id;
            const pending = user?.pendingPlan === id;
            return (
              <article key={id} className={current ? "plan-p actual" : "plan-p"}>
                <div className="top">
                  <h3>{item.name}</h3>
                  <span className="pr">{priceLabel(item)}</span>
                </div>
                <p>{item.summary}</p>
                <div className="pie-p">
                  {current ? <span className="etq">Plan actual</span> : null}
                  {pending ? <span className="etq pend">Solicitud pendiente</span> : null}
                  {user && !current ? (
                    <form action={requestPlanAction}>
                      <input type="hidden" name="plan" value={id} />
                      <button type="submit" className="btn btn-secundario btn-chico">
                        Solicitar este plan
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {user ? (
        <form action={changePasswordAction} className="panel bloque-cuenta">
          <h2 className="t2">Cambiar contraseña</h2>
          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <div className="campo">
              <label htmlFor="pass-actual">Contraseña actual</label>
              <input
                id="pass-actual"
                name="actual"
                type="password"
                autoComplete="current-password"
                required
                className="inp"
              />
            </div>
            <div className="campo">
              <label htmlFor="pass-nueva">Contraseña nueva</label>
              <input
                id="pass-nueva"
                name="nueva"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="inp"
              />
            </div>
            <button type="submit" className="btn btn-secundario">
              Guardar contraseña
            </button>
          </div>
        </form>
      ) : null}
    </main>
  );
}

function Cupo({ used, limit }: { used: number; limit: Plan["rtfLimit"] }) {
  if (limit === null) {
    return (
      <div className="medidor">
        <div className="cifra">
          {used}
          <small>este mes</small>
        </div>
        <p className="lbl">consultas al RTF editable · sin límite</p>
      </div>
    );
  }

  const remaining = Math.max(0, limit - used);
  const ticks = limit === 0 ? 1 : Math.min(limit, 24);
  const filled = limit === 0 ? 0 : Math.round((Math.min(used, limit) / limit) * ticks);

  return (
    <div className="medidor">
      <div className="cifra">
        {used}
        <small>de {limit}</small>
      </div>
      <p className="lbl">consultas al RTF editable este mes</p>
      <div className="barra-cupo" aria-hidden="true">
        {Array.from({ length: ticks }, (_, index) => (
          <i key={index} className={index < filled ? "u" : undefined} />
        ))}
      </div>
      <p className="renueva">Te quedan {remaining}. El mes se cuenta en hora de Lima.</p>
    </div>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}
