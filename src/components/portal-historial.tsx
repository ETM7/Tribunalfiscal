import { MonthJump } from "@/components/month-jump";
import type { AccountDetail } from "@/lib/accounts";
import type { ReadingLog } from "@/lib/profile";
import { limaMonth, PLANS } from "@/lib/plans";
import { limaStamp, monthOfIso, monthTitle } from "@/lib/profile";

export function PortalHistorial({
  account,
  vista,
  mes,
}: {
  account: AccountDetail;
  vista: "lecturas" | "busquedas";
  mes: string;
}) {
  const plan = PLANS[account.plan];
  const months = monthChoices(account);
  const selected = months.some((item) => item.value === mes) ? mes : months[0].value;
  const readings = readingRows(account, selected);
  const searches = account.searches.filter((item) => monthOfIso(item.at) === selected);
  const readingCount = selected === limaMonth() ? account.rtfOpens : new Set(readings.map((item) => item.resolutionId)).size;
  const downloads = readings.filter((item) => item.downloaded).length;
  const remaining = plan.rtfLimit === null ? null : Math.max(0, plan.rtfLimit - readingCount);
  const title = monthTitle(selected);

  return (
    <section>
      <div className="stats">
        <article className="stat">
          <span>Lecturas en {title.split(" ")[0].toLocaleLowerCase("es-PE")}</span>
          <b>
            {readingCount}
            {plan.rtfLimit === null ? "" : ` de ${plan.rtfLimit}`}
          </b>
          <small>{remaining === null ? "Sin tope" : `${remaining} disponibles`}</small>
        </article>
        <article className="stat">
          <span>Búsquedas en {title.split(" ")[0].toLocaleLowerCase("es-PE")}</span>
          <b>{searches.length}</b>
          <small>No consumen cupo</small>
        </article>
        <article className="stat">
          <span>Descargas editables</span>
          <b>{downloads}</b>
          <small>Este mes</small>
        </article>
      </div>

      <div className="fila-historial">
        <div className="vista" role="tablist" aria-label="Qué historial ver">
          <a href={`/portal?seccion=historial&vista=lecturas&mes=${selected}`} aria-current={vista === "lecturas" ? "page" : undefined}>
            Lecturas
          </a>
          <a href={`/portal?seccion=historial&vista=busquedas&mes=${selected}`} aria-current={vista === "busquedas" ? "page" : undefined}>
            Búsquedas
          </a>
        </div>
        <MonthJump mes={selected} vista={vista} months={months} />
      </div>

      {vista === "busquedas" ? (
        <Table
          heads={["Fecha", "Búsqueda"]}
          empty={`En ${title.toLocaleLowerCase("es-PE")} todavía no hay búsquedas guardadas.`}
          rows={searches.map((item) => [limaStamp(item.at), item.query])}
        />
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Expediente</th>
                <th>Criterio buscado</th>
                <th>Descargada</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={5}>En {title.toLocaleLowerCase("es-PE")} todavía no hay lecturas.</td>
                </tr>
              ) : (
                readings.map((item) => (
                  <tr key={`${item.at}-${item.resolutionId}`}>
                    <td>{item.at ? limaStamp(item.at) : "Este mes"}</td>
                    <td className="mono">{item.resolutionId}</td>
                    <td>{item.criterion || "—"}</td>
                    <td>{item.downloaded ? "Sí" : "No"}</td>
                    <td>
                      <a href={`/lectura?id=${encodeURIComponent(item.resolutionId)}`}>Abrir</a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Table({ heads, rows, empty }: { heads: string[]; rows: string[][]; empty: string }) {
  return (
    <div className="tabla-wrap">
      <table className="tabla">
        <thead>
          <tr>
            {heads.map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={heads.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((cell, index) => (
                  <td key={`${index}-${cell}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function readingRows(account: AccountDetail, mes: string): ReadingLog[] {
  const logged = account.readings.filter((item) => monthOfIso(item.at) === mes);
  const seen = new Set(logged.map((item) => item.resolutionId));
  const extras: ReadingLog[] =
    mes === account.usageMonth
      ? account.openedIds
          .filter((id) => !seen.has(id))
          .map((id) => ({ at: "", resolutionId: id, criterion: "", downloaded: false }))
      : [];
  return [...logged, ...extras].sort((left, right) => right.at.localeCompare(left.at));
}

function monthChoices(account: AccountDetail): Array<{ value: string; label: string }> {
  const values = new Set<string>([limaMonth()]);
  for (const item of account.readings) {
    const month = monthOfIso(item.at);
    if (month) values.add(month);
  }
  for (const item of account.searches) {
    const month = monthOfIso(item.at);
    if (month) values.add(month);
  }
  return [...values]
    .sort()
    .reverse()
    .map((value) => ({ value, label: monthTitle(value) }));
}
