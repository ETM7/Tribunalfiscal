"use client";

import { useMemo, useState } from "react";
import { assignPlanAction, confirmPaymentAction, resetUsageAction } from "@/app/admin/actions";
import type { PublicUser } from "@/lib/accounts";
import { PLAN_ORDER, PLANS, priceLabel } from "@/lib/plans";

export function AdminPeople({ users }: { users: PublicUser[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      users.filter(
        (user) => !needle || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle),
      ),
    [users, needle],
  );

  return (
    <section id="personas">
      <div className="personas-cab">
        <h2>Personas</h2>
        <input
          className="inp"
          type="search"
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar persona"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {shown.length === 0 ? <p className="f-meta">Ninguna persona coincide.</p> : null}
      {shown.map((account) => {
        const plan = PLANS[account.plan];
        const width = plan.rtfLimit ? Math.min(100, (account.rtfOpens / plan.rtfLimit) * 100) : 0;
        return (
          <article key={account.id} className="persona">
            <div>
              <h3>
                {account.name}{" "}
                <span className={account.role === "admin" ? "rol adm" : "rol"}>
                  {account.role === "admin" ? "Administrador" : "Cuenta"}
                </span>
              </h3>
              <div className="mail">{account.email}</div>
              <div className="uso">
                Plan {plan.name}. Consultas al RTF este mes: {account.rtfOpens}
                {plan.rtfLimit === null ? " · sin límite" : ` de ${plan.rtfLimit}`}
                {plan.rtfLimit ? (
                  <span className="mini-barra" aria-hidden="true">
                    <i style={{ width: `${width}%` }} />
                  </span>
                ) : null}
              </div>
              {account.pendingPlan ? (
                <div className="pide">
                  Pidió {PLANS[account.pendingPlan].name} · {priceLabel(PLANS[account.pendingPlan], account.pendingCycle ?? "mensual")}
                </div>
              ) : null}
            </div>
            <div className="acc">
              <form action={assignPlanAction} className="acc">
                <input type="hidden" name="userId" value={account.id} />
                <select name="plan" className="inp" aria-label={`Asignar plan a ${account.name}`} defaultValue={account.pendingPlan ?? account.plan}>
                  {PLAN_ORDER.map((id) => (
                    <option key={id} value={id}>
                      {PLANS[id].name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-secundario btn-chico">
                  Guardar plan
                </button>
              </form>
              {account.pendingPlan ? (
                <form action={confirmPaymentAction}>
                  <input type="hidden" name="userId" value={account.id} />
                  <button type="submit" className="btn btn-primario btn-chico">
                    Confirmar pago
                  </button>
                </form>
              ) : null}
              <form action={resetUsageAction}>
                <input type="hidden" name="userId" value={account.id} />
                <button type="submit" className="btn btn-secundario btn-chico">
                  Reiniciar cupo
                </button>
              </form>
            </div>
          </article>
        );
      })}
    </section>
  );
}
