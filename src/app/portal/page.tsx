import { changePasswordAction, loginAction, registerAction, requestPlanAction } from "@/app/portal/actions";
import { currentUser } from "@/lib/session";
import { PLAN_ORDER, PLANS, priceLabel } from "@/lib/plans";

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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.16em] text-[var(--seal)] uppercase">Portal</p>
        <h1 className="mt-2 font-serif text-4xl text-[var(--ink)]">Tu cuenta</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Todos los planes pueden buscar. El botón Abrir RTF editable depende del plan. Aquí no se
          cobra la tarjeta: solicitas el plan y el administrador lo activa cuando confirma el pago.
        </p>
      </header>

      {aviso ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm" role="status">
          {aviso}
        </p>
      ) : null}

      {user && plan ? (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <h2 className="font-serif text-2xl">Plan {plan.name}</h2>
          <p className="mt-2 text-sm leading-6">
            {user.name} · {user.email}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{plan.summary}</p>
          <p className="mt-3 text-sm leading-6">
            Consultas al RTF editable este mes: {user.rtfOpens}
            {plan.rtfLimit === null ? " · sin límite" : ` de ${plan.rtfLimit}`}. Cada resolución distinta
            cuenta una vez. Volver a abrirla no gasta otra. El mes se cuenta en hora de Lima.
          </p>
          {user.pendingPlan ? (
            <p className="mt-3 text-sm text-[var(--seal)]">
              Tienes una solicitud pendiente del plan {PLANS[user.pendingPlan].name}. Sigue activo{" "}
              {plan.name} hasta que administración confirme el pago.
            </p>
          ) : null}
        </section>
      ) : (
        <section id="entrar" className="grid gap-4 lg:grid-cols-2">
          <form action={loginAction} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
            <h2 className="font-serif text-2xl">Entrar</h2>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Correo</span>
                <input name="email" type="email" autoComplete="username" required className="field" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Contraseña</span>
                <input name="password" type="password" autoComplete="current-password" required className="field" />
              </label>
              <button type="submit" className="primary">
                Entrar
              </button>
            </div>
          </form>
          <form action={registerAction} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
            <h2 className="font-serif text-2xl">Crear cuenta Junior</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Es gratis. Puedes buscar enseguida. El RTF editable se abre desde Senior.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Nombre</span>
                <input name="nombre" autoComplete="name" required className="field" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Correo</span>
                <input name="email" type="email" autoComplete="email" required className="field" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Contraseña</span>
                <input name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
              </label>
              <button type="submit" className="primary">
                Crear cuenta
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Planes</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PLAN_ORDER.map((id) => {
            const item = PLANS[id];
            const current = user?.plan === id;
            return (
              <li key={id} className="flex flex-col rounded-2xl border border-[var(--line)] bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-xl">{item.name}</h3>
                  <p className="text-sm font-semibold">{priceLabel(item)}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
                {current ? <p className="mt-3 text-sm font-semibold text-[var(--seal)]">Plan actual</p> : null}
                {user?.pendingPlan === id ? (
                  <p className="mt-2 text-sm text-[var(--seal)]">Solicitud pendiente</p>
                ) : null}
                {user && !current ? (
                  <form action={requestPlanAction} className="mt-4">
                    <input type="hidden" name="plan" value={id} />
                    <button type="submit" className="secondary">
                      Solicitar este plan
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {user ? (
        <form action={changePasswordAction} className="max-w-md rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <h2 className="font-serif text-2xl">Cambiar contraseña</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Contraseña actual</span>
              <input name="actual" type="password" autoComplete="current-password" required className="field" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Contraseña nueva</span>
              <input name="nueva" type="password" autoComplete="new-password" minLength={8} required className="field" />
            </label>
            <button type="submit" className="secondary">
              Guardar contraseña
            </button>
          </div>
        </form>
      ) : null}
    </main>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}
