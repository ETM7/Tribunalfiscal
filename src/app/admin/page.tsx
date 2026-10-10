import { redirect } from "next/navigation";
import { assignPlanAction, confirmPaymentAction, createUserAction, resetUsageAction } from "@/app/admin/actions";
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.16em] text-[var(--seal)] uppercase">Administración</p>
        <h1 className="mt-2 font-serif text-4xl text-[var(--ink)]">Cuentas y planes</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Asigna el plan cuando el pago esté confirmado. Esta pantalla no cobra la tarjeta. El cupo
          del RTF editable se reinicia solo cada mes, en hora de Lima, o cuando lo pongas en cero.
        </p>
      </header>

      {aviso ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm" role="status">
          {aviso}
        </p>
      ) : null}

      <form action={createUserAction} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <h2 className="font-serif text-2xl">Nueva cuenta</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Nombre</span>
            <input name="nombre" required className="field" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Correo</span>
            <input name="email" type="email" required className="field" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Contraseña inicial</span>
            <input name="password" type="text" minLength={8} required className="field" autoComplete="off" />
            <span className="text-[var(--muted)]">Queda visible para que puedas entregarla.</span>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Plan</span>
            <select name="plan" className="field" defaultValue="junior">
              {PLAN_ORDER.map((id) => (
                <option key={id} value={id}>
                  {PLANS[id].name} · {priceLabel(PLANS[id])}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input name="rol" type="checkbox" value="admin" />
            También es administrador
          </label>
          <button type="submit" className="primary sm:col-span-2 sm:w-fit">
            Crear cuenta
          </button>
        </div>
      </form>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Personas</h2>
        <ul className="grid gap-3">
          {users.map((account) => (
            <li key={account.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{account.name}</h3>
                <p className="text-sm text-[var(--muted)]">{account.role === "admin" ? "Administrador" : "Cuenta"}</p>
              </div>
              <p className="mt-1 text-sm break-all">{account.email}</p>
              <p className="mt-2 text-sm leading-6">
                Plan {PLANS[account.plan].name}. Consultas al RTF este mes: {account.rtfOpens}
                {PLANS[account.plan].rtfLimit === null ? " · sin límite" : ` de ${PLANS[account.plan].rtfLimit}`}.
              </p>
              {account.pendingPlan ? (
                <p className="mt-2 text-sm text-[var(--seal)]">
                  Pidió {PLANS[account.pendingPlan].name} · {priceLabel(PLANS[account.pendingPlan])}.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <form action={assignPlanAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="userId" value={account.id} />
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Asignar plan</span>
                    <select name="plan" className="field" defaultValue={account.pendingPlan ?? account.plan}>
                      {PLAN_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {PLANS[id].name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="secondary">
                    Guardar plan
                  </button>
                </form>
                {account.pendingPlan ? (
                  <form action={confirmPaymentAction}>
                    <input type="hidden" name="userId" value={account.id} />
                    <button type="submit" className="primary">
                      Confirmar pago
                    </button>
                  </form>
                ) : null}
                <form action={resetUsageAction}>
                  <input type="hidden" name="userId" value={account.id} />
                  <button type="submit" className="secondary">
                    Reiniciar cupo
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}
