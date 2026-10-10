import { loginAction, linkedInLoginAction, registerAction } from "@/app/portal/actions";
import { isPortalSection, PortalAccount, type PortalSection } from "@/components/portal-account";
import { getAccount, readEmailConfirmToken, readStudentConfirmToken } from "@/lib/accounts";
import { limaMonth } from "@/lib/plans";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

type PortalProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalPage({ searchParams }: PortalProps) {
  const params = await searchParams;
  const aviso = first(params.aviso).slice(0, 300);
  const studentSignup = first(params.alta) === "estudiante";
  const user = await currentUser();
  const account = user ? await getAccount(user.id) : null;
  const section: PortalSection = isPortalSection(first(params.seccion)) ? first(params.seccion) as PortalSection : "resumen";
  const vista = first(params.vista) === "busquedas" ? "busquedas" : "lecturas";
  const mes = /^\d{4}-\d{2}$/.test(first(params.mes)) ? first(params.mes) : limaMonth();

  return (
    <main className={account ? "envoltura ancha" : "envoltura"}>
      {aviso ? (
        <p className="aviso" role="status">
          {aviso}
        </p>
      ) : null}

      {account ? (
        <PortalAccount
          account={account}
          section={section}
          vista={vista}
          mes={mes}
          studentToken={await readStudentConfirmToken(account.id)}
          emailToken={await readEmailConfirmToken(account.id)}
        />
      ) : (
        <>
          <div className="app-cab">
            <span className="rotulo">Portal</span>
            <h1>Tu cuenta</h1>
            <p>
              Todos los planes pueden buscar. El botón Abrir RTF editable depende del plan. Aquí no se cobra la tarjeta:
              solicitas el plan y el administrador lo activa cuando confirma el pago.
            </p>
          </div>
          <section id="entrar" className="portal-grid">
            <div className="panel">
              <h2 className="t2">Entrar</h2>
              <p className="sub">Con el correo de tu cuenta.</p>
              <form action={loginAction} className="form-grid">
                <div className="campo">
                  <label htmlFor="login-email">Correo</label>
                  <input id="login-email" name="email" type="email" autoComplete="username" required className="inp" />
                </div>
                <div className="campo">
                  <label htmlFor="login-password">Contraseña</label>
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="inp"
                  />
                </div>
                <button type="submit" className="btn btn-primario">
                  Entrar
                </button>
              </form>
              <form action={linkedInLoginAction}>
                <button type="submit" className="btn btn-secundario">
                  Entrar con LinkedIn
                </button>
              </form>
            </div>
            <form id="registro" action={registerAction} className="panel">
              <h2 className="t2">{studentSignup ? "Regístrate con tu correo de estudiante" : "Crear cuenta Junior"}</h2>
              <p className="sub">
                {studentSignup
                  ? "Usa el correo que te dio tu universidad, terminado en edu.pe. Después abres el enlace para confirmarlo. Dura un año."
                  : "Es gratis. Puedes buscar enseguida e incluye 3 lecturas del RTF editable al mes."}
              </p>
              {studentSignup ? <input type="hidden" name="estudiante" value="1" /> : null}
              <div className="form-grid">
                <div className="campo">
                  <label htmlFor="reg-nombre">Nombre</label>
                  <input id="reg-nombre" name="nombre" autoComplete="name" required className="inp" />
                </div>
                <div className="campo">
                  <label htmlFor="reg-email">Correo</label>
                  <input id="reg-email" name="email" type="email" autoComplete="email" required className="inp" />
                </div>
                <div className="campo">
                  <label htmlFor="reg-password">Contraseña</label>
                  <input
                    id="reg-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="inp"
                  />
                </div>
                <button type="submit" className="btn btn-primario">
                  Crear cuenta
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}
