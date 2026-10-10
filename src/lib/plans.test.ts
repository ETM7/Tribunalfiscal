import assert from "node:assert/strict";
import test from "node:test";
import {
  annualMonthlyEquivalent,
  describeRtf,
  formatSoles,
  isEduPeEmail,
  limaMonth,
  limaMonthName,
  limaRenewalLabel,
  planRequestNotice,
  PLANS,
  priceLabel,
  quotaFoot,
  rtfQuota,
} from "./plans";

test("el mes de Lima cambia a las 00:00, cinco horas antes que UTC", () => {
  assert.equal(limaMonth(new Date("2026-01-01T04:30:00Z")), "2025-12");
  assert.equal(limaMonth(new Date("2026-01-01T05:30:00Z")), "2026-01");
  assert.equal(limaMonthName(new Date("2026-10-10T15:00:00Z")), "octubre");
  assert.equal(limaRenewalLabel(new Date("2026-10-10T15:00:00Z")), "1/11");
  assert.equal(limaRenewalLabel(new Date("2026-01-01T04:30:00Z")), "1/1");
  assert.equal(limaRenewalLabel(new Date("2026-12-15T15:00:00Z")), "1/1");
});

test("los precios y los cupos del RTF son los del plan", () => {
  assert.equal(PLANS.junior.priceSoles, 0);
  assert.equal(PLANS.junior.rtfLimit, 3);
  assert.equal(PLANS.senior.priceSoles, 39);
  assert.equal(PLANS.senior.annualPriceSoles, 390);
  assert.equal(PLANS.senior.rtfLimit, 30);
  assert.equal(PLANS.gerente.priceSoles, 89);
  assert.equal(PLANS.gerente.annualPriceSoles, 890);
  assert.equal(PLANS.gerente.rtfLimit, null);
  assert.equal(PLANS.socio.name, "Estudio");
  assert.equal(PLANS.socio.priceSoles, 249);
  assert.equal(PLANS.socio.annualPriceSoles, 2490);
  assert.equal(PLANS.socio.rtfLimit, null);
  assert.equal(priceLabel(PLANS.junior), "Gratis");
  assert.equal(priceLabel(PLANS.senior), "S/ 39 al mes");
  assert.equal(priceLabel(PLANS.senior, "anual"), "S/ 390 al año");
  assert.equal(priceLabel(PLANS.gerente, "anual"), "S/ 890 al año");
  assert.equal(priceLabel(PLANS.socio, "anual"), "S/ 2,490 al año");
  assert.equal(annualMonthlyEquivalent(PLANS.senior), "32.50");
  assert.equal(annualMonthlyEquivalent(PLANS.gerente), "74.17");
  assert.equal(annualMonthlyEquivalent(PLANS.socio), "207.50");
  assert.equal(formatSoles(2490), "2,490");
  assert.equal(quotaFoot(PLANS.gerente), "1 usuario");
  assert.equal(quotaFoot(PLANS.socio), "hasta 5 usuarios");
  assert.equal(rtfQuota(PLANS.junior).amount, "3 lecturas");
  assert.equal(rtfQuota(PLANS.senior).amount, "30 lecturas");
  assert.equal(rtfQuota(PLANS.socio).amount, "Sin límite");
  assert.match(planRequestNotice(PLANS.senior, "anual"), /S\/ 390 al año/);
  assert.match(planRequestNotice(PLANS.senior, "anual"), /diez meses/);
  assert.equal(isEduPeEmail("alumno@pucp.edu.pe"), true);
  assert.equal(isEduPeEmail("a@edu.pe"), true);
  assert.equal(isEduPeEmail("a@gmail.com"), false);
  assert.equal(isEduPeEmail("a@notedu.pe"), false);
});

test("sin sesión el RTF queda cerrado y Junior tiene tres lecturas", () => {
  assert.equal(describeRtf(null).allowed, false);
  const junior = describeRtf({ plan: "junior", usageMonth: "2026-10", rtfOpens: 0 }, new Date("2026-10-05T15:00:00Z"));
  assert.equal(junior.allowed, true);
  assert.equal(junior.remaining, 3);
  const spent = describeRtf({ plan: "junior", usageMonth: "2026-10", rtfOpens: 3 }, new Date("2026-10-05T15:00:00Z"));
  assert.equal(spent.allowed, false);
});

test("Senior cuenta el cupo del mes de Lima y Estudio no tiene tope", () => {
  const october = new Date("2026-10-05T15:00:00Z");
  const senior = describeRtf({ plan: "senior", usageMonth: "2026-10", rtfOpens: 29 }, october);
  assert.equal(senior.allowed, true);
  assert.equal(senior.remaining, 1);
  const spent = describeRtf({ plan: "senior", usageMonth: "2026-10", rtfOpens: 30 }, october);
  assert.equal(spent.allowed, false);
  const nextMonth = describeRtf({ plan: "senior", usageMonth: "2026-10", rtfOpens: 30 }, new Date("2026-11-02T15:00:00Z"));
  assert.equal(nextMonth.allowed, true);
  assert.equal(nextMonth.remaining, 30);
  assert.equal(describeRtf({ plan: "gerente", usageMonth: "2026-10", rtfOpens: 400 }, october).allowed, true);
  assert.equal(describeRtf({ plan: "socio", usageMonth: "2026-10", rtfOpens: 400 }, october).allowed, true);
});
