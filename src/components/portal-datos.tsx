import {
  disconnectLinkedInAction,
  importLinkedInAction,
  removeCvAction,
  removePhotoAction,
  saveProfileAction,
} from "@/app/portal/actions";
import type { AccountDetail } from "@/lib/accounts";
import { bytesLabel, displayName, DOC_TYPES, initials, limaDay, PROFESSIONS, profileCompleteness } from "@/lib/profile";

export function PortalDatos({
  account,
  emailToken,
  studentToken,
}: {
  account: AccountDetail;
  emailToken: string | null;
  studentToken: string | null;
}) {
  const profile = account.profile;
  const name = displayName(account.name, profile);
  const score = profileCompleteness(profile);

  return (
    <form action={saveProfileAction} className="datos-grid">
      <div className="panel datos-panel">
        <span className="rotulo">Datos personales</span>
        <div className="pares">
          <Field id="nombres" name="nombres" label="Nombres" defaultValue={profile.givenNames} autoComplete="given-name" />
          <Field id="apellidos" name="apellidos" label="Apellidos" defaultValue={profile.surnames} autoComplete="family-name" />
          <div className="campo">
            <label htmlFor="numero">Documento</label>
            <div className="doc-linea">
              <select id="documento" name="documento" className="inp" defaultValue={profile.docType} aria-label="Tipo de documento">
                {DOC_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <input id="numero" name="numero" className="inp" defaultValue={profile.docNumber} inputMode="numeric" />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="celular">Celular</label>
            <input id="celular" name="celular" className="inp" defaultValue={profile.phone} autoComplete="tel" />
            {profile.phone && !profile.phoneConfirmed ? (
              <button className="btn btn-secundario btn-chico" type="submit" name="confirmar" value="1">
                Confirmar celular
              </button>
            ) : null}
          </div>
        </div>
        <Field id="email" name="email" label="Correo" type="email" defaultValue={account.email} autoComplete="email" />
        <p className="ayuda">Si lo cambias, dejamos un enlace en esta página para confirmarlo. No sale un correo.</p>
        {account.pendingEmail && emailToken ? (
          <p className="aviso">
            Confirma {account.pendingEmail}:{" "}
            <a href={`/confirmar-correo?token=${encodeURIComponent(emailToken)}`}>Confirmar correo nuevo</a>
          </p>
        ) : null}
        <Field
          id="estudiante"
          name="estudiante"
          label="Correo de estudiante (opcional)"
          type="email"
          defaultValue={profile.studentEmail}
          placeholder="tu.nombre@universidad.edu.pe"
        />
        <p className="ayuda">Si lo confirmas, pasas al plan Estudiante: 5 lecturas gratis al mes. Se revalida cada año.</p>
        {profile.studentEmail && studentToken ? (
          <p className="aviso">
            Abre el enlace para confirmar ese correo:{" "}
            <a href={`/confirmar-estudiante?token=${encodeURIComponent(studentToken)}`}>Confirmar correo de estudiante</a>
          </p>
        ) : null}

        <span className="rotulo seccion-rot">Datos profesionales</span>
        <div className="pares">
          <div className="campo">
            <label htmlFor="profesion">Profesión</label>
            <select id="profesion" name="profesion" className="inp" defaultValue={profile.profession}>
              <option value="">Elegir</option>
              {PROFESSIONS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="colegiatura">N.º de colegiatura</label>
            <input id="colegiatura" name="colegiatura" className="inp" defaultValue={profile.licenseNumber} />
            <p className="ayuda">Colegio de Abogados o de Contadores.</p>
          </div>
          <Field id="estudio" name="estudio" label="Estudio o empresa" defaultValue={profile.firm} />
          <Field id="cargo" name="cargo" label="Cargo" defaultValue={profile.jobTitle} />
        </div>
        <Field id="especialidad" name="especialidad" label="Especialidad" defaultValue={profile.specialty} />

        <span className="rotulo seccion-rot">Datos de facturación</span>
        <div className="pares">
          <div className="campo">
            <span className="lbl">Comprobante</span>
            <div className="segmento">
              <label>
                <input type="radio" name="comprobante" value="boleta" defaultChecked={profile.receipt === "boleta"} />
                Boleta
              </label>
              <label>
                <input type="radio" name="comprobante" value="factura" defaultChecked={profile.receipt === "factura"} />
                Factura
              </label>
            </div>
          </div>
          <Field id="ruc" name="ruc" label="RUC" defaultValue={profile.ruc} inputMode="numeric" />
        </div>
        <Field id="razon" name="razon" label="Razón social" defaultValue={profile.legalName} />
        <Field id="direccion" name="direccion" label="Dirección fiscal" defaultValue={profile.fiscalAddress} />

        <span className="rotulo seccion-rot">Redes y enlaces</span>
        <LinkedInRows account={account} />
        <div className="red">
          <span className="red-marca">X</span>
          <div>
            <b>X (Twitter)</b>
            <small>Opcional</small>
          </div>
          <input name="twitter" className="inp" defaultValue={profile.twitter} placeholder="@usuario" aria-label="Usuario de X" />
        </div>
        <div className="red">
          <span className="red-marca fb">f</span>
          <div>
            <b>Facebook</b>
            <small>Opcional</small>
          </div>
          <input name="facebook" className="inp" defaultValue={profile.facebook} placeholder="facebook.com/..." aria-label="Facebook" />
        </div>
        <div className="red">
          <span className="red-marca web">www</span>
          <div>
            <b>Web personal o del estudio</b>
            <small>Opcional</small>
          </div>
          <input name="web" className="inp" defaultValue={profile.website} placeholder="estudiotorres.pe" aria-label="Sitio web" />
        </div>

        <div className="acciones-datos">
          <button type="reset" className="btn btn-secundario">
            Descartar cambios
          </button>
          <button type="submit" className="btn btn-primario">
            Guardar datos
          </button>
        </div>
      </div>

      <div className="lado">
        <section className="panel centro">
          <span className="rotulo">Foto de perfil</span>
          {profile.hasPhoto ? (
            <img className="foto-grande" src="/portal/archivo/foto" alt="" />
          ) : (
            <span className="foto-grande" aria-hidden="true">
              {initials(name)}
            </span>
          )}
          <div className="botones-foto">
            <label className="btn btn-secundario btn-chico">
              Subir foto
              <input type="file" name="foto" accept="image/jpeg,image/png" hidden />
            </label>
            {profile.hasPhoto ? (
              <button type="submit" className="btn btn-secundario btn-chico" formAction={removePhotoAction}>
                Quitar
              </button>
            ) : null}
          </div>
          <p className="ayuda">JPG o PNG, cuadrada, hasta 2 MB.</p>
        </section>

        <section className="panel">
          <span className="rotulo">Currículum (CV)</span>
          {profile.hasCv ? (
            <div className="cv-fila">
              <span className="cv-tipo">PDF</span>
              <div>
                <b>{profile.cvName}</b>
                <small>
                  {bytesLabel(profile.cvBytes)}
                  {profile.cvUploadedAt ? ` · subido el ${limaDay(profile.cvUploadedAt)}` : ""}
                </small>
              </div>
            </div>
          ) : (
            <p className="ayuda">Todavía no hay un CV.</p>
          )}
          <div className="botones-foto">
            {profile.hasCv ? (
              <a className="btn btn-secundario btn-chico" href="/portal/archivo/cv">
                Ver
              </a>
            ) : null}
            <label className="btn btn-secundario btn-chico">
              {profile.hasCv ? "Reemplazar" : "Subir CV"}
              <input type="file" name="cv" accept=".pdf,.doc,.docx,application/pdf" hidden />
            </label>
            {profile.hasCv ? (
              <button type="submit" className="btn btn-secundario btn-chico" formAction={removeCvAction}>
                Eliminar
              </button>
            ) : null}
          </div>
          <p className="ayuda">PDF o Word, hasta 5 MB. Solo tú lo ves, salvo que actives la opción de abajo.</p>
          <label className="interruptor">
            <span>Compartir mi CV con estudios que buscan especialistas</span>
            <input type="checkbox" name="compartir" value="1" defaultChecked={profile.shareCv} />
          </label>
        </section>

        <section className="panel">
          <span className="rotulo">Perfil completo</span>
          <div className="pct">{score.percent}%</div>
          <div className="barra-cupo" aria-hidden="true">
            <span style={{ width: `${score.percent}%` }} />
          </div>
          <p className="renueva">{score.missing ? `Te falta: ${score.missing}` : "Listo."}</p>
        </section>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
  type = "text",
  autoComplete,
  placeholder,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text" | "email" | "tel";
}) {
  return (
    <div className="campo">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        className="inp"
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </div>
  );
}

function LinkedInRows({ account }: { account: AccountDetail }) {
  if (!account.linkedin) {
    return (
      <p className="ayuda">
        LinkedIn se conecta en <a href="/portal?seccion=seguridad">Seguridad</a>.
      </p>
    );
  }
  return (
    <>
      <div className="red">
        <span className="red-marca in">in</span>
        <div>
          <b>LinkedIn</b>
          <small>Conectado como {account.linkedin.name}</small>
        </div>
        <button type="submit" className="btn btn-secundario btn-chico" formAction={disconnectLinkedInAction}>
          Desconectar
        </button>
      </div>
      <div className="red import-ln">
        <span className="avatar chico" aria-hidden="true">
          {initials(account.linkedin.name)}
        </span>
        <div>
          <b>{account.linkedin.name}</b>
          <small>
            {account.linkedin.email} · nombre, foto y correo
          </small>
        </div>
        <button type="submit" className="btn btn-secundario btn-chico" formAction={importLinkedInAction}>
          Importar nombre y foto
        </button>
      </div>
    </>
  );
}
