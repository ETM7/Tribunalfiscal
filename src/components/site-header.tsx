import { logoutAction } from "@/app/portal/actions";
import type { PublicUser } from "@/lib/accounts";
import { PLANS } from "@/lib/plans";

export function SiteHeader({ user }: { user: PublicUser | null }) {
  return (
    <header className="barra">
      <div className="envoltura">
        <a className="marca" href="/">
          <span className="punto" aria-hidden="true" />
          Tribunal Fiscal
        </a>
        <nav className="nav" aria-label="Principal">
          <a href="/" className="ocultable">
            Inicio
          </a>
          {user ? (
            <span className="estado-sesion ocultable">
              {user.name} · {PLANS[user.plan].name}
            </span>
          ) : (
            <a href="/portal">Entrar</a>
          )}
          {user ? <a href="/portal">Portal</a> : null}
          {user?.role === "admin" ? <a href="/admin">Administración</a> : null}
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
