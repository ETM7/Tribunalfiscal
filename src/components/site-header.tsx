import { logoutAction } from "@/app/portal/actions";
import type { PublicUser } from "@/lib/accounts";
import { PLANS } from "@/lib/plans";

export function SiteHeader({ user }: { user: PublicUser | null }) {
  return (
    <div className="topbar">
      <a className="marca" href="/">
        Tribunal Fiscal
      </a>
      <nav>
        {user ? (
          <span className="text-sm text-[var(--muted)]">
            {user.name} · {PLANS[user.plan].name}
          </span>
        ) : (
          <span className="text-sm text-[var(--muted)]">Sin sesión</span>
        )}
        <a href="/portal">Portal</a>
        {user?.role === "admin" ? <a href="/admin">Administración</a> : null}
        {user ? (
          <form action={logoutAction}>
            <button type="submit" className="linkish">
              Salir
            </button>
          </form>
        ) : null}
      </nav>
    </div>
  );
}
