"use client";

import { useState } from "react";
import { requestPlanAction } from "@/app/portal/actions";
import type { PublicUser } from "@/lib/accounts";
import {
  annualMonthlyEquivalent,
  formatSoles,
  PLAN_ORDER,
  PLANS,
  quotaFoot,
  rtfQuota,
  type BillingCycle,
  type Plan,
  type PlanId,
} from "@/lib/plans";

const AUDIENCE: Record<Exclude<PlanId, "estudiante">, string> = {
  junior: "Para probar sin compromiso.",
  senior: "Para el abogado que litiga cada semana.",
  gerente: "Para quien vive en la jurisprudencia.",
  socio: "Para equipos y áreas legales.",
};

const FEATURED: PlanId = "senior";

export function PriceBoard({ user }: { user: PublicUser | null }) {
  const [cycle, setCycle] = useState<BillingCycle>("mensual");

  return (
    <>
      <div className="ciclo" role="radiogroup" aria-label="Tarifa">
        <button type="button" aria-pressed={cycle === "mensual"} onClick={() => setCycle("mensual")}>
          Mensual
        </button>
        <button type="button" aria-pressed={cycle === "anual"} onClick={() => setCycle("anual")}>
          Anual <span className="promo">2 meses gratis</span>
        </button>
      </div>
      <div className="planes">
        {PLAN_ORDER.map((id) => (
          <PlanCard key={id} plan={PLANS[id]} user={user} cycle={cycle} />
        ))}
      </div>
      <StudentOffer />
    </>
  );
}

function PlanCard({
  plan,
  user,
  cycle,
}: {
  plan: Plan;
  user: PublicUser | null;
  cycle: BillingCycle;
}) {
  const quota = rtfQuota(plan);
  const featured = plan.id === FEATURED;
  const current = user?.plan === plan.id;
  const pending = user?.pendingPlan === plan.id;
  const annual = cycle === "anual" && plan.annualPriceSoles > 0;
  const amount = annual ? formatSoles(plan.annualPriceSoles) : String(plan.priceSoles);

  return (
    <article className={featured ? "plan dest" : "plan"}>
      {featured ? <span className="cinta">Más elegido</span> : null}
      <h3>{plan.name}</h3>
      <p className="para">{plan.id === "estudiante" ? "" : AUDIENCE[plan.id]}</p>
      {plan.priceSoles === 0 ? (
        <div className="monto">
          <span className="n">Gratis</span>
        </div>
      ) : (
        <div className="monto">
          <span className="s">S/</span>
          <span className={amount.length > 3 ? "n n-largo" : "n"}>{amount}</span>
          <span className="per">{annual ? "al año" : "al mes"}</span>
        </div>
      )}
      <p className="equiv">{annual ? `Equivale a S/ ${annualMonthlyEquivalent(plan)} al mes` : ""}</p>
      <div className="cuota">
        <b>{quota.amount}</b>
        <span>{quotaFoot(plan)}</span>
      </div>
      <ul>
        {bullets(plan.id).map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
      <div className="accion">
        {pending ? <span className="etq pend">Solicitud pendiente</span> : null}
        <PlanButton plan={plan} user={user} current={current} featured={featured} cycle={cycle} />
      </div>
    </article>
  );
}

function PlanButton({
  plan,
  user,
  current,
  featured,
  cycle,
}: {
  plan: Plan;
  user: PublicUser | null;
  current: boolean;
  featured: boolean;
  cycle: BillingCycle;
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
      <input type="hidden" name="ciclo" value={cycle} />
      <input type="hidden" name="volver" value="precios" />
      <button type="submit" className={featured ? "btn btn-primario" : "btn btn-secundario"}>
        Solicitar {plan.name}
      </button>
    </form>
  );
}

function StudentOffer() {
  return (
    <article className="oferta-est">
      <div>
        <span className="insignia-uni">Con correo universitario</span>
        <h3>Estudiante</h3>
        <p className="para">Para quien estudia Derecho o Contabilidad.</p>
      </div>
      <div className="lectura-est">
        <span className="gratis">Gratis</span>
        <div className="cifra-est">
          <b>5 lecturas</b>
          <span>al mes, mientras estudies</span>
        </div>
      </div>
      <ul>
        <li>Búsquedas sin límite</li>
        <li>Dónde aparece el criterio, por página</li>
        <li>Resumen del PDF</li>
        <li>Descarga editable</li>
      </ul>
      <div className="cta-est">
        <a className="btn btn-primario" href="/portal?alta=estudiante#registro">
          Regístrate con tu correo de estudiante
        </a>
        <p className="nota-est">
          Solo con el correo que te dio tu universidad (por ejemplo, terminado en edu.pe). Lo confirmamos con un enlace
          y lo revalidamos cada año.
        </p>
      </div>
    </article>
  );
}

function bullets(id: PlanId): string[] {
  if (id === "estudiante") return [];
  if (id === "junior") {
    return [
      "Búsquedas sin límite",
      "Sumilla junto a cada expediente",
      "Historial de búsquedas",
      "Descarga editable",
    ];
  }
  if (id === "senior") {
    return [
      "Todo lo de Junior",
      "Dónde aparece el criterio, por página",
      "Resumen del PDF",
      "Descarga editable",
    ];
  }
  if (id === "gerente") {
    return [
      "Todo lo de Senior",
      "Lecturas sin límite",
      "Historial guardado en tu cuenta",
      "Soporte por WhatsApp",
    ];
  }
  return [
    "Todo lo de Gerente",
    "Un administrador gestiona el equipo",
    "Uso por persona en el mes",
    "Factura a nombre del estudio",
  ];
}
