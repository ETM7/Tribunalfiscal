import type { Metadata } from "next";
import { requestPlanAction } from "@/app/portal/actions";
import type { PublicUser } from "@/lib/accounts";
import { PLAN_ORDER, PLANS, rtfQuota, type Plan, type PlanId } from "@/lib/plans";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Precios · Tribunal Fiscal",
  description:
    "Buscar es gratis. Los planes de pago abren el RTF editable: Junior gratis, Senior S/ 39, Gerente S/ 89 y Socio S/ 249 al mes.",
};

const AUDIENCE: Record<PlanId, string> = {
  junior: "Para probar sin compromiso.",
  senior: "Para el abogado que litiga cada semana.",
  gerente: "Para quien vive en la jurisprudencia.",
  socio: "Para quien necesita el RTF editable sin tope.",
};

const FEATURED: PlanId = "senior";

export default async function PreciosPage() {
  const user = await currentUser();
  return (
    <main>
      <section className="precios-hero">
        <div className="envoltura">
          <span className="rotulo">Precios</span>
          <h1>Buscar es gratis. Pagas por leer dentro de la resolución.</h1>
          <p>
            Una lectura es abrir el RTF editable, con el texto buscable. Volver a abrir la misma resolución en el mes
            no cuenta otra vez.
          </p>
          <div className="planes">
            {PLAN_ORDER.map((id) => (
              <PlanCard key={id} plan={PLANS[id]} user={user} />
            ))}
          </div>
        </div>
      </section>

      <section className="bloque">
        <div className="envoltura">
          <div className="cab-sec">
            <span className="rotulo">Cómo se cuenta</span>
            <h2>Reglas claras, sin letra chica.</h2>
          </div>
          <div className="regla">
            <div>
              <h3>Una resolución, una lectura</h3>
              <p>Cada resolución distinta cuenta una vez al mes. Reabrirla no descuenta otra.</p>
            </div>
            <div>
              <h3>El mes es de Lima</h3>
              <p>El cupo del RTF editable se renueva a medianoche, hora de Lima, el primer día de cada mes.</p>
            </div>
            <div>
              <h3>Sin sorpresas</h3>
              <p>Si pides otro plan, sigues con el anterior hasta que administración confirme el pago.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bloque">
        <div className="envoltura">
          <div className="cab-sec">
            <span className="rotulo">Comparar planes</span>
            <h2>Qué incluye cada uno.</h2>
          </div>
          <div className="tabla-scroll">
            <table className="comp">
              <thead>
                <tr>
                  <th>Función</th>
                  {PLAN_ORDER.map((id) => (
                    <th key={id}>{PLANS[id].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Búsquedas y sumillas</td>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="si">
                      Sin límite
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Consultas al RTF editable</td>
                  {PLAN_ORDER.map((id) => {
                    const plan = PLANS[id];
                    const tone = plan.rtfLimit === null ? "si" : plan.rtfLimit === 0 ? "nn" : undefined;
                    return (
                      <td key={id} className={tone}>
                        {rtfQuota(plan).cell}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>Texto buscable y descarga editable</td>
                  {PLAN_ORDER.map((id) =>
                    PLANS[id].rtfLimit === 0 ? (
                      <td key={id} className="nn">
                        —
                      </td>
                    ) : (
                      <td key={id} className="si">
                        ✓
                      </td>
                    ),
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bloque" id="pago">
        <div className="envoltura">
          <div className="cab-sec">
            <span className="rotulo">Cómo se pide</span>
            <h2>Solicitas el plan. El administrador lo activa al confirmar el pago.</h2>
            <p>Desde tu cuenta eliges Senior, Gerente o Socio. Mientras la solicitud está pendiente, sigue tu plan actual.</p>
          </div>
          <div className="pasos">
            <div className="paso">
              <h3>Entras o creas tu cuenta</h3>
              <p>Junior es gratis y queda listo al registrarte.</p>
            </div>
            <div className="paso">
              <h3>Pides el plan</h3>
              <p>En Precios o en el portal pulsas solicitar. La solicitud queda anotada en tu cuenta.</p>
            </div>
            <div className="paso">
              <h3>Administración confirma el pago</h3>
              <p>El plan anterior sigue activo hasta esa confirmación.</p>
            </div>
            <div className="paso">
              <h3>Queda activo el plan pedido</h3>
              <p>Desde ese momento el RTF editable sigue el cupo del plan confirmado.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bloque faq">
        <div className="envoltura">
          <div className="cab-sec">
            <span className="rotulo">Preguntas</span>
            <h2>Antes de solicitar un plan.</h2>
          </div>
          <details>
            <summary>¿Es el sitio oficial del Tribunal Fiscal?</summary>
            <p>
              No. Es una herramienta independiente que consulta en vivo el buscador público del MEF. El PDF oficial
              siempre se abre en el sitio del MEF.
            </p>
          </details>
          <details>
            <summary>¿Qué cuenta como una lectura?</summary>
            <p>
              Abrir el RTF editable de una resolución. Cada resolución distinta cuenta una vez por mes. Buscar y leer
              sumillas no cuenta.
            </p>
          </details>
          <details>
            <summary>¿Cómo pido un plan de pago?</summary>
            <p>
              Entras al portal y pulsas «Solicitar este plan». El administrador lo activa cuando confirma el pago.
              Mientras tanto sigue tu plan actual.
            </p>
          </details>
          <details>
            <summary>¿El plan Junior abre el RTF editable?</summary>
            <p>Junior busca sin límite. El botón Abrir RTF editable empieza en Senior.</p>
          </details>
        </div>
      </section>
    </main>
  );
}

function PlanCard({ plan, user }: { plan: Plan; user: PublicUser | null }) {
  const quota = rtfQuota(plan);
  const featured = plan.id === FEATURED;
  const current = user?.plan === plan.id;
  const pending = user?.pendingPlan === plan.id;
  return (
    <article className={featured ? "plan dest" : "plan"}>
      {featured ? <span className="cinta">Más elegido</span> : null}
      <h3>{plan.name}</h3>
      <p className="para">{AUDIENCE[plan.id]}</p>
      {plan.priceSoles === 0 ? (
        <div className="monto">
          <span className="n">Gratis</span>
        </div>
      ) : (
        <div className="monto">
          <span className="s">S/</span>
          <span className="n">{plan.priceSoles}</span>
          <span className="per">al mes</span>
        </div>
      )}
      <div className="cuota">
        <b>{quota.amount}</b>
        <span>{quota.caption}</span>
      </div>
      <ul>
        {bullets(plan).map((item) => (
          <li key={item.text} className={item.off ? "no" : undefined}>
            {item.text}
          </li>
        ))}
      </ul>
      <div className="accion">
        {pending ? <span className="etq pend">Solicitud pendiente</span> : null}
        <PlanButton plan={plan} user={user} current={current} featured={featured} />
      </div>
    </article>
  );
}

function PlanButton({
  plan,
  user,
  current,
  featured,
}: {
  plan: Plan;
  user: PublicUser | null;
  current: boolean;
  featured: boolean;
}) {
  if (current) {
    return (
      <span className="btn btn-bloq" aria-disabled="true">
        Plan actual
      </span>
    );
  }
  if (!user) {
    if (plan.priceSoles === 0) {
      return (
        <a className="btn btn-secundario" href="/portal">
          Crear cuenta gratis
        </a>
      );
    }
    return (
      <a className={featured ? "btn btn-primario" : "btn btn-secundario"} href={`/portal?plan=${plan.id}`}>
        Solicitar {plan.name}
      </a>
    );
  }
  return (
    <form action={requestPlanAction}>
      <input type="hidden" name="plan" value={plan.id} />
      <button type="submit" className={featured ? "btn btn-primario" : "btn btn-secundario"}>
        Solicitar este plan
      </button>
    </form>
  );
}

function bullets(plan: Plan): Array<{ text: string; off?: boolean }> {
  if (plan.id === "junior") {
    return [
      { text: "Búsquedas sin límite" },
      { text: "Sumilla junto a cada expediente" },
      { text: "Historial de búsquedas en el navegador" },
      { text: "Botón Abrir RTF editable", off: true },
    ];
  }
  const previous = plan.id === "senior" ? "Junior" : plan.id === "gerente" ? "Senior" : "Gerente";
  const quota =
    plan.rtfLimit === null
      ? "Consultas al RTF editable sin límite"
      : `${plan.rtfLimit} consultas al RTF editable al mes`;
  return [
    { text: `Todo lo de ${previous}` },
    { text: quota },
    { text: "Texto buscable con Control+F" },
    { text: "Descarga editable" },
  ];
}
