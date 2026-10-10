export const PLAN_ORDER = ["junior", "senior", "gerente", "socio"] as const;

export type PlanId = (typeof PLAN_ORDER)[number];

export type Plan = {
  id: PlanId;
  name: string;
  priceSoles: number;
  rtfLimit: number | null;
  summary: string;
};

export const PLANS: Record<PlanId, Plan> = {
  junior: {
    id: "junior",
    name: "Junior",
    priceSoles: 0,
    rtfLimit: 0,
    summary: "Búsquedas sin límite. Sin el botón Abrir RTF editable.",
  },
  senior: {
    id: "senior",
    name: "Senior",
    priceSoles: 39,
    rtfLimit: 20,
    summary: "Búsquedas sin límite y 20 consultas al RTF editable al mes.",
  },
  gerente: {
    id: "gerente",
    name: "Gerente",
    priceSoles: 89,
    rtfLimit: 100,
    summary: "Búsquedas sin límite y 100 consultas al RTF editable al mes.",
  },
  socio: {
    id: "socio",
    name: "Socio",
    priceSoles: 249,
    rtfLimit: null,
    summary: "Búsquedas y consultas al RTF editable sin límite.",
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
      note: "Entra al portal para abrir el RTF editable. El plan Junior es gratis y permite buscar, sin ese botón.",
    };
  }

  const plan = PLANS[user.plan];
  const used = usageThisMonth(user, now);
  if (plan.rtfLimit === 0) {
    return {
      allowed: false,
      remaining: 0,
      note: "El plan Junior permite buscar, sin acceso al RTF editable.",
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

export function priceLabel(plan: Plan): string {
  return plan.priceSoles === 0 ? "Gratis" : `S/ ${plan.priceSoles} al mes`;
}

export function planRequestNotice(plan: Plan): string {
  if (plan.priceSoles === 0) {
    return `Solicitaste volver al plan ${plan.name}. El administrador lo activa.`;
  }
  return `Solicitaste el plan ${plan.name}, ${priceLabel(plan)}. El administrador lo activa cuando confirma el pago.`;
}
