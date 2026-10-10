import { changePasswordAction, connectLinkedInAction } from "@/app/portal/actions";
import type { AccountDetail } from "@/lib/accounts";

export function PortalSeguridad({ account }: { account: AccountDetail }) {
  return (
    <div className="seguridad-col">
      <form action={changePasswordAction} className="panel">
        <input type="hidden" name="seccion" value="seguridad" />
        <h2 className="t2">Cambiar contraseña</h2>
        <div className="form-grid">
          <div className="campo">
            <label htmlFor="pass-actual">Contraseña actual</label>
            <input id="pass-actual" name="actual" type="password" autoComplete="current-password" required className="inp" />
          </div>
          <div className="campo">
            <label htmlFor="pass-nueva">Contraseña nueva</label>
            <input id="pass-nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} required className="inp" />
          </div>
          <button type="submit" className="btn btn-secundario">
            Guardar contraseña
          </button>
        </div>
      </form>

      <section className="panel">
        <h2 className="t2">Entrar con LinkedIn</h2>
        {account.linkedin ? (
          <p className="sub">
            Tu cuenta está vinculada como {account.linkedin.name}. Puedes importar el nombre desde Datos personales. La
            entrada de esta copia sigue pidiendo contraseña.
          </p>
        ) : (
          <>
            <p className="sub">Vincula tu nombre y correo para mostrarlos en el portal. No abre la sesión de LinkedIn.</p>
            <form action={connectLinkedInAction}>
              <button type="submit" className="btn btn-primario">
                Conectar LinkedIn
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
