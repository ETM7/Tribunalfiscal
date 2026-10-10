import assert from "node:assert/strict";
import test from "node:test";
import { describeRtf, limaMonth, planRequestNotice, PLANS, priceLabel } from "./plans";

test("el mes de Lima cambia a las 00:00, cinco horas antes que UTC", () => {
  assert.equal(limaMonth(new Date("2026-01-01T04:30:00Z")), "2025-12");
  assert.equal(limaMonth(new Date("2026-01-01T05:30:00Z")), "2026-01");
});

test("los precios y los cupos del RTF son los del plan", () => {
  assert.equal(PLANS.junior.priceSoles, 0);
  assert.equal(PLANS.junior.rtfLimit, 0);
  assert.equal(PLANS.senior.priceSoles, 39);
  assert.equal(PLANS.senior.rtfLimit, 20);
  assert.equal(PLANS.gerente.priceSoles, 89);
  assert.equal(PLANS.gerente.rtfLimit, 100);
  assert.equal(PLANS.socio.priceSoles, 249);
  assert.equal(PLANS.socio.rtfLimit, null);
  assert.equal(priceLabel(PLANS.junior), "Gratis");
  assert.equal(priceLabel(PLANS.senior), "S/ 39 al mes");
  assert.equal(priceLabel(PLANS.gerente), "S/ 89 al mes");
  assert.equal(priceLabel(PLANS.socio), "S/ 249 al mes");
  assert.match(planRequestNotice(PLANS.senior), /S\/ 39/);
  assert.match(planRequestNotice(PLANS.gerente), /S\/ 89/);
  assert.match(planRequestNotice(PLANS.socio), /S\/ 249/);
  assert.doesNotMatch(planRequestNotice(PLANS.senior), /49|99|300/);
});

test("sin sesión y en Junior el RTF editable queda cerrado", () => {
  assert.equal(describeRtf(null).allowed, false);
  assert.equal(
    describeRtf({ plan: "junior", usageMonth: "2026-10", rtfOpens: 0 }, new Date("2026-10-05T15:00:00Z")).allowed,
    false,
  );
});

test("Senior cuenta el cupo del mes de Lima y Socio no tiene tope", () => {
  const october = new Date("2026-10-05T15:00:00Z");
  const senior = describeRtf({ plan: "senior", usageMonth: "2026-10", rtfOpens: 19 }, october);
  assert.equal(senior.allowed, true);
  assert.equal(senior.remaining, 1);
  const spent = describeRtf({ plan: "senior", usageMonth: "2026-10", rtfOpens: 20 }, october);
  assert.equal(spent.allowed, false);
  const nextMonth = describeRtf({ plan: "senior", usageMonth: "2026-10", rtfOpens: 20 }, new Date("2026-11-02T15:00:00Z"));
  assert.equal(nextMonth.allowed, true);
  assert.equal(nextMonth.remaining, 20);
  assert.equal(describeRtf({ plan: "socio", usageMonth: "2026-10", rtfOpens: 400 }, october).allowed, true);
});
