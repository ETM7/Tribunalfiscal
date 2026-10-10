import { logoutAction } from "@/app/portal/actions";
import { NavLink } from "@/components/nav-link";
import type { PublicUser } from "@/lib/accounts";
import { PLANS, usageThisMonth } from "@/lib/plans";

export function SiteHeader({ user }: { user: PublicUser | null }) {
  return (
    <header className="barra">
      <div className="envoltura">
        <a className="marca" href="/">
          <span className="punto" aria-hidden="true" />
          Tribunal Fiscal
        </a>
        <nav className="nav" aria-label="Principal">
          <NavLink href="/">Inicio</NavLink>
          <NavLink href="/precios">Precios</NavLink>
          <NavLink href="/buscar">Buscar</NavLink>
          <NavLink href="/lectura">Lector</NavLink>
          {user ? (
            <span className="estado-sesion">{sessionLine(user)}</span>
          ) : (
            <NavLink href="/portal">Entrar</NavLink>
          )}
          {user ? <NavLink href="/portal">Portal</NavLink> : null}
          {user?.role === "admin" ? <NavLink href="/admin">Administración</NavLink> : null}
          {user ? (
            <form action={logoutAction}>
              <button type="submit" className="linkish">
                Salir
              </button>
            </form>
          ) : (
            <a className="btn btn-primario btn-chico" href="/portal">
              Crear cuenta<span className="txt-largo"> gratis</span>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

function sessionLine(user: PublicUser): string {
  const plan = PLANS[user.plan];
  const used = usageThisMonth(user);
  if (plan.rtfLimit === null) return `${user.name} · ${plan.name}`;
  const left = Math.max(0, plan.rtfLimit - used);
  return `${user.name} · ${plan.name} · ${left} lecturas`;
}
