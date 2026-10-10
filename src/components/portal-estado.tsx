import { addCardAction, removeCardAction, setAutoRenewAction, useCardAction } from "@/app/portal/actions";
import type { AccountDetail } from "@/lib/accounts";
import { brandLabel, chargeDateLabel, limaDay, type PayCard } from "@/lib/profile";
import { formatSoles, type Plan } from "@/lib/plans";

export function PortalEstado({ account, plan }: { account: AccountDetail; plan: Plan }) {
  const price = formatSoles(plan.priceSoles, true);
  const renewal =
    plan.priceSoles === 0
      ? "Este plan no tiene cobro."
      : account.autoRenew
        ? `Cobramos S/ ${price} a tu tarjeta cada mes. Puedes desactivarla cuando quieras.`
        : "La renovación automática está apagada. El plan sigue hasta el cierre de este mes.";

  return (
    <section>
      <div className="estado-grid">
        <article className="panel">
          <span className="rotulo">Tu suscripción</span>
          <div className="pares suscripcion">
            <div>
              <span className="lbl">Plan</span>
              <b>
                {plan.name} · {plan.priceSoles === 0 ? "Gratis" : `S/ ${plan.priceSoles} al mes`}
              </b>
            </div>
            <div>
              <span className="lbl">Próximo cobro</span>
              <b>{plan.priceSoles === 0 ? "—" : chargeDateLabel()}</b>
            </div>
            <div>
              <span className="lbl">Saldo pendiente</span>
              <b>S/ {formatSoles(0, true)}</b>
            </div>
            <div>
              <span className="lbl">Cliente desde</span>
              <b>{limaDay(account.createdAt)}</b>
            </div>
          </div>
          <div className="renovacion">
            <div>
              <b>Renovación automática</b>
              <p>{renewal}</p>
            </div>
            <form action={setAutoRenewAction}>
              <input type="hidden" name="activa" value={account.autoRenew ? "0" : "1"} />
              <button
                type="submit"
                className="switch"
                aria-pressed={account.autoRenew}
                aria-label="Renovación automática"
              />
            </form>
          </div>
        </article>

        <article className="panel">
          <span className="rotulo">Medio de pago</span>
          {account.cards.length === 0 ? <p className="ayuda">Todavía no hay una tarjeta guardada.</p> : null}
          {account.cards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
          <details className="agregar-tarjeta">
            <summary className="btn btn-secundario">+ Agregar tarjeta</summary>
            <form action={addCardAction} className="form-grid">
              <div className="campo">
                <label htmlFor="marca">Marca</label>
                <select id="marca" name="marca" className="inp" defaultValue="visa">
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="ultimos">Últimos 4</label>
                <input id="ultimos" name="ultimos" className="inp" inputMode="numeric" maxLength={4} required />
              </div>
              <div className="campo">
                <label htmlFor="vence">Vencimiento</label>
                <input id="vence" name="vence" className="inp" placeholder="08/29" required />
              </div>
              <button type="submit" className="btn btn-primario btn-chico">
                Guardar tarjeta
              </button>
              <p className="ayuda">Solo guardamos la marca, los últimos 4 y el vencimiento. Desde aquí no se cobra la tarjeta.</p>
            </form>
          </details>
        </article>
      </div>

      <div className="mov-cab">
        <h2>Movimientos</h2>
        <a className="btn btn-secundario" href="/portal/estado">
          Descargar estado de cuenta (PDF)
        </a>
      </div>
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Medio</th>
              <th>Comprobante</th>
              <th>Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {account.movements.length === 0 ? (
              <tr>
                <td colSpan={6}>Todavía no hay movimientos. Cuando administración confirma un pago, queda anotado aquí.</td>
              </tr>
            ) : (
              account.movements.map((item) => (
                <tr key={item.id}>
                  <td>{limaDay(item.at)}</td>
                  <td>{item.concept}</td>
                  <td>{item.last4 ? `${brandLabel(item.brand)} •••• ${item.last4}` : "—"}</td>
                  <td>{item.receipt || "—"}</td>
                  <td>S/ {formatSoles(item.amountSoles, true)}</td>
                  <td>
                    <span className={item.status === "pagado" ? "estado-ok" : "estado-no"}>
                      {item.status === "pagado" ? "Pagado" : "Rechazado"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CardRow({ card }: { card: PayCard }) {
  return (
    <div className="tarjeta-pago">
      <span className={card.brand === "visa" ? "marca-visa" : "mc"} aria-hidden="true">
        {card.brand === "visa" ? "VISA" : <><i /><i /></>}
      </span>
      <div>
        <b>•••• {card.last4}</b>
        <small>
          Vence {card.expiry}
          {card.principal ? " · Principal" : ""}
        </small>
      </div>
      <div className="tarjeta-acc">
        {card.principal ? null : (
          <form action={useCardAction}>
            <input type="hidden" name="tarjeta" value={card.id} />
            <button type="submit" className="linkish">
              Usar
            </button>
          </form>
        )}
        <form action={removeCardAction}>
          <input type="hidden" name="tarjeta" value={card.id} />
          <button type="submit" className="linkish">
            Quitar
          </button>
        </form>
      </div>
    </div>
  );
}
