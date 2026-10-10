import { beginStudentAction, requestPlanAction } from "@/app/portal/actions";
import { PortalDatos } from "@/components/portal-datos";
import { PortalEstado } from "@/components/portal-estado";
import { PortalHistorial } from "@/components/portal-historial";
import { PortalSeguridad } from "@/components/portal-seguridad";
import type { AccountDetail } from "@/lib/accounts";
import { limaMonthName, limaRenewalLabel, PLAN_ORDER, PLANS, priceLabel, studentIsCurrent, usageThisMonth, type Plan } from "@/lib/plans";
import { brandLabel, chargeDateLabel, displayName, initials, professionLabel } from "@/lib/profile";

export const PORTAL_SECTIONS = [
  ["resumen", "Resumen"],
  ["datos", "Datos personales"],
  ["historial", "Historial"],
  ["estado", "Estado de cuenta"],
  ["seguridad", "Seguridad"],
] as const;

export type PortalSection = (typeof PORTAL_SECTIONS)[number][0];

export function isPortalSection(value: string): value is PortalSection {
  return PORTAL_SECTIONS.some(([id]) => id === value);
}

export function PortalAccount({
  account,
  section,
  vista,
  mes,
  studentToken,
  emailToken,
}: {
  account: AccountDetail;
  section: PortalSection;
  vista: "lecturas" | "busquedas";
  mes: string;
  studentToken: string | null;
  emailToken: string | null;
}) {
  const plan = PLANS[account.plan];
  const name = displayName(account.name, account.profile);
  const bits = [professionLabel(account.profile.profession), account.profile.firm, plan.name].filter(Boolean);

  return (
    <>
      <div className="app-cab">
        <h1>Tu cuenta</h1>
        <p>
          Buscar es gratis en todos los planes. Para leer dentro de las resoluciones, elige un plan: con tarjeta Visa o
          Mastercard se activa al instante; con Yape, Plin o transferencia, cuando confirmamos el pago.
        </p>
      </div>

      <header className="ficha-portal">
        <Avatar label={name} hasPhoto={account.profile.hasPhoto} />
        <div>
          <div className="ficha-nom">
            <h2>{name}</h2>
            {account.linkedin ? <span className="vinculo">LinkedIn vinculado</span> : null}
          </div>
          <p>{bits.join(" · ")}</p>
        </div>
      </header>

      <nav className="pestanas" aria-label="Secciones de la cuenta">
        {PORTAL_SECTIONS.map(([id, label]) => (
          <a key={id} href={`/portal?seccion=${id}`} aria-current={section === id ? "page" : undefined}>
            {label}
          </a>
        ))}
      </nav>

      {section === "resumen" ? (
        <Resumen account={account} plan={plan} name={name} studentToken={studentToken} />
      ) : null}
      {section === "datos" ? <PortalDatos account={account} emailToken={emailToken} studentToken={studentToken} /> : null}
      {section === "historial" ? <PortalHistorial account={account} vista={vista} mes={mes} /> : null}
      {section === "estado" ? <PortalEstado account={account} plan={plan} /> : null}
      {section === "seguridad" ? <PortalSeguridad account={account} /> : null}
    </>
  );
}

function Avatar({ label, hasPhoto }: { label: string; hasPhoto: boolean }) {
  if (hasPhoto) {
    return <img className="avatar" src="/portal/archivo/foto" alt="" />;
  }
  return (
    <span className="avatar" aria-hidden="true">
      {initials(label)}
    </span>
  );
}

function Resumen({
  account,
  plan,
  name,
  studentToken,
}: {
  account: AccountDetail;
  plan: Plan;
  name: string;
  studentToken: string | null;
}) {
  const card = account.cards.find((item) => item.principal) ?? account.cards[0];
  const quota = plan.rtfLimit === null ? "Lecturas sin límite" : `${plan.rtfLimit} lecturas al mes`;
  const withCard = card ? ` con tu ${brandLabel(card.brand)} •••• ${card.last4}` : "";

  return (
    <>
      <section className="panel">
        <div className="cuenta">
          <div>
            <span className="rotulo">Plan actual</span>
            <div className="plan-nom">{plan.name}</div>
            <p className="quien-es">
              {name} · {account.email}
            </p>
            <p className="quien-es" style={{ marginTop: "0.45rem" }}>
              {quota}, resumen del PDF y descarga editable. Se renueva el {chargeDateLabel()}
              {withCard}.
            </p>
          </div>
          <Cupo used={usageThisMonth(account)} limit={plan.rtfLimit} />
        </div>
        <p className="regla-cupo">Cada resolución distinta cuenta una vez al mes. Volver a abrir la misma no descuenta otra.</p>
        <StudentBox userPlan={account.plan} studentUntil={account.studentUntil} token={studentToken} />
        {account.pendingPlan ? (
          <div className="pendiente">
            <span className="ic" aria-hidden="true">
              …
            </span>
            <p>
              <strong>
                Solicitaste {PLANS[account.pendingPlan].name} (
                {priceLabel(PLANS[account.pendingPlan], account.pendingCycle ?? "mensual")}).
              </strong>{" "}
              Sigue activo {plan.name} hasta que administración confirme el pago.
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <div className="cab-sec">
          <span className="rotulo">Planes</span>
          <h2>Cambia de plan cuando lo necesites.</h2>
        </div>
        <div className="planes-p">
          {PLAN_ORDER.map((id) => {
            const item = PLANS[id];
            const current = account.plan === id;
            const pending = account.pendingPlan === id;
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
                  {!current ? (
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
    </>
  );
}

function StudentBox({
  userPlan,
  studentUntil,
  token,
}: {
  userPlan: Plan["id"];
  studentUntil: string | null;
  token: string | null;
}) {
  const current = studentIsCurrent(studentUntil);
  if (!token && userPlan === "estudiante" && current) return null;
  if (!token && userPlan !== "estudiante") return null;
  return (
    <div className="aviso" style={{ marginTop: "1rem" }}>
      {token ? (
        <p style={{ margin: 0 }}>
          Abre este enlace para confirmar el correo de estudiante:{" "}
          <a href={`/confirmar-estudiante?token=${encodeURIComponent(token)}`}>Confirmar mi correo</a>
        </p>
      ) : current ? (
        <p style={{ margin: 0 }}>
          El beneficio de estudiante está activo hasta el{" "}
          {new Date(studentUntil || "").toLocaleDateString("es-PE", { timeZone: "America/Lima" })}.
        </p>
      ) : (
        <form action={beginStudentAction}>
          <p style={{ margin: "0 0 0.7rem" }}>
            {studentUntil
              ? "El año de estudiante venció. Si tu correo sigue siendo universitario, genera otro enlace."
              : "Si tu correo termina en edu.pe, puedes pasar al plan Estudiante: 5 lecturas al mes."}
          </p>
          <button type="submit" className="btn btn-primario btn-chico">
            Generar enlace de confirmación
          </button>
        </form>
      )}
    </div>
  );
}

function Cupo({ used, limit }: { used: number; limit: Plan["rtfLimit"] }) {
  const month = limaMonthName();
  const renewal = limaRenewalLabel();
  if (limit === null) {
    return (
      <div className="medidor">
        <div className="cifra">
          {used}
          <small>lecturas</small>
        </div>
        <p className="lbl">usadas en {month}</p>
        <p className="renueva">Este plan no tiene tope. Se sigue contando el mes, sin descontar un paquete.</p>
      </div>
    );
  }
  const remaining = Math.max(0, limit - used);
  const ratio = limit === 0 ? 0 : Math.min(used, limit) / limit;
  return (
    <div className="medidor">
      <div className="cifra">
        {used}
        <small>de {limit} lecturas</small>
      </div>
      <p className="lbl">usadas en {month}</p>
      <div
        className="barra-cupo"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-label={`${used} de ${limit} lecturas usadas en ${month}`}
      >
        <span style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <p className="renueva">
        Se renueva el {renewal} a medianoche, hora de Lima. Te quedan {remaining}.
      </p>
    </div>
  );
}
