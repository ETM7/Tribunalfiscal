import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chargeDateLabel, emptyProfile, parseCardInput, profileCompleteness, toPublicProfile } from "./profile";
import { statementPdf } from "./statement-pdf";

describe("perfil", () => {
  test("el perfil incompleto señala el celular confirmado", () => {
    const profile = toPublicProfile({
      ...emptyProfile(),
      givenNames: "Ana",
      surnames: "Torres",
      docNumber: "45879213",
      phone: "+51 987 654 321",
      profession: "abogado",
      firm: "Estudio Torres",
      photoFile: "foto.jpg",
      cvFile: "cv.bin",
    });
    const score = profileCompleteness(profile);
    assert.equal(score.percent, 85);
    assert.equal(score.missing, "confirmar tu celular.");
  });

  test("el próximo cobro es el último día del mes de Lima", () => {
    assert.equal(chargeDateLabel(new Date("2026-10-10T15:00:00Z")), "31/10/2026");
  });

  test("una tarjeta no acepta el número completo", () => {
    assert.equal(parseCardInput("visa", "4111111111114821", "08/29").ok, false);
    const card = parseCardInput("mastercard", "7703", "03/28");
    assert.equal(card.ok, true);
    if (card.ok) assert.equal(card.value.last4, "7703");
    const longYear = parseCardInput("visa", "4821", "08/2029");
    assert.equal(longYear.ok, true);
    if (longYear.ok) assert.equal(longYear.value.expiry, "08/29");
  });

  test("el estado de cuenta sale como PDF", () => {
    const pdf = Buffer.from(statementPdf(["Estado de cuenta", "Senior"]));
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  });
});
