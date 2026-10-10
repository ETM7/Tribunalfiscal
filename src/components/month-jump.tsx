"use client";

export function MonthJump({
  mes,
  vista,
  months,
}: {
  mes: string;
  vista: string;
  months: Array<{ value: string; label: string }>;
}) {
  return (
    <form action="/portal" method="get" className="mes-jump">
      <input type="hidden" name="seccion" value="historial" />
      <input type="hidden" name="vista" value={vista} />
      <select
        name="mes"
        aria-label="Mes"
        defaultValue={mes}
        className="inp mes-sel"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {months.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>
    </form>
  );
}
