export const PLAN_ORDER = ["junior", "senior", "gerente", "socio"] as const;

export type PlanId = (typeof PLAN_ORDER)[number];

export type BillingCycle = "mensual" | "anual";

export type Plan = {
  id: PlanId;
  name: string;
  priceSoles: number;
  annualPriceSoles: number;
  rtfLimit: number | null;
  summary: string;
};

export const PLANS: Record<PlanId, Plan> = {
  junior: {
    id: "junior",
    name: "Junior",
    priceSoles: 0,
    annualPriceSoles: 0,
    rtfLimit: 3,
    summary: "Búsquedas sin límite y 3 lecturas del RTF editable al mes.",
  },
  senior: {
    id: "senior",
    name: "Senior",
    priceSoles: 39,
    annualPriceSoles: 390,
    rtfLimit: 30,
    summary: "Búsquedas sin límite y 30 lecturas del RTF editable al mes.",
  },
  gerente: {
    id: "gerente",
    name: "Gerente",
    priceSoles: 89,
    annualPriceSoles: 890,
    rtfLimit: null,
    summary: "Búsquedas y lecturas del RTF editable sin límite, para una persona.",
  },
  socio: {
    id: "socio",
    name: "Estudio",
    priceSoles: 249,
    annualPriceSoles: 2490,
    rtfLimit: null,
    summary: "Búsquedas y lecturas del RTF editable sin límite, hasta 5 usuarios.",
  },
};

export type RtfAccess = {
  allowed: boolean;
  note: string;
  remaining: number | null;
};

export function isPlanId(value: string): value is PlanId {
  return Object.prototype.hasOwnProperty.call(PLANS, value);
}

export function limaMonth(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}

export function limaMonthName(now = new Date()): string {
  const name = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    month: "long",
  }).format(now);
  return name.toLocaleLowerCase("es-PE");
}

/** Primer día del mes siguiente en Lima, como «1/11». */
export function limaRenewalLabel(now = new Date()): string {
  const month = Number(limaMonth(now).slice(5, 7));
  const next = month === 12 ? 1 : month + 1;
  return `1/${next}`;
}

export function usageThisMonth(user: { usageMonth: string; rtfOpens: number }, now = new Date()): number {
  return user.usageMonth === limaMonth(now) ? user.rtfOpens : 0;
}

export function describeRtf(
  user: { plan: PlanId; usageMonth: string; rtfOpens: number } | null,
  now = new Date(),
): RtfAccess {
  if (!user) {
    return {
      allowed: false,
      remaining: null,
      note: "Entra al portal para abrir el RTF editable. El plan Junior es gratis e incluye 3 lecturas al mes.",
    };
  }

  const plan = PLANS[user.plan];
  const used = usageThisMonth(user, now);
  if (plan.rtfLimit === 0) {
    return {
      allowed: false,
      remaining: 0,
      note: "El plan Junior ya usó sus lecturas de este mes.",
    };
  }
  if (plan.rtfLimit === null) {
    return { allowed: true, remaining: null, note: "" };
  }

  const remaining = Math.max(0, plan.rtfLimit - used);
  if (remaining === 0) {
    return {
      allowed: false,
      remaining: 0,
      note: `Este mes ya usaste las ${plan.rtfLimit} consultas al RTF editable del plan ${plan.name}.`,
    };
  }
  return { allowed: true, remaining, note: "" };
}

export function isBillingCycle(value: string): value is BillingCycle {
  return value === "mensual" || value === "anual";
}

/** Correo de una institución peruana: @edu.pe o @algo.edu.pe. */
export function isEduPeEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return domain === "edu.pe" || domain.endsWith(".edu.pe");
}

export function formatSoles(amount: number, decimals = false): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(amount);
}

export function annualMonthlyEquivalent(plan: Plan): string {
  return formatSoles(plan.annualPriceSoles / 12, true);
}

export function priceLabel(plan: Plan, cycle: BillingCycle = "mensual"): string {
  if (plan.priceSoles === 0) return "Gratis";
  if (cycle === "anual") return `S/ ${formatSoles(plan.annualPriceSoles)} al año`;
  return `S/ ${plan.priceSoles} al mes`;
}

/** Bajo el cupo: personas del plan, o «al mes» si el cupo es de lecturas. */
export function quotaFoot(plan: Plan): string {
  if (plan.id === "gerente") return "1 usuario";
  if (plan.id === "socio") return "hasta 5 usuarios";
  return "al mes";
}

export function rtfQuota(plan: Plan): { amount: string; caption: string; cell: string } {
  if (plan.rtfLimit === null) {
    return { amount: "Sin límite", caption: "consultas al RTF editable", cell: "Sin límite" };
  }
  if (plan.rtfLimit === 0) {
    return { amount: "Sin lecturas", caption: "del RTF editable", cell: "—" };
  }
  return {
    amount: `${plan.rtfLimit} lecturas`,
    caption: "al mes",
    cell: `${plan.rtfLimit} al mes`,
  };
}

export function planRequestNotice(plan: Plan, cycle: BillingCycle = "mensual"): string {
  if (plan.priceSoles === 0) {
    return `Solicitaste volver al plan ${plan.name}. El administrador lo activa.`;
  }
  const period = cycle === "anual" ? "La tarifa anual equivale a diez meses." : "La tarifa es mensual.";
  return `Solicitaste el plan ${plan.name}, ${priceLabel(plan, cycle)}. ${period} El administrador lo activa cuando confirma el pago.`;
}
