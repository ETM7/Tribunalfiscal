import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import {
  adminNotePath,
  assignPlan,
  beginStudentConfirmation,
  confirmPendingPlan,
  confirmStudentByToken,
  consumeRtf,
  createUser,
  ensureAdmin,
  getUser,
  loginUser,
  readStudentConfirmToken,
  registerUser,
  requestPlan,
  addCard,
  getAccount,
  resetUsage,
  saveProfile,
} from "./accounts";

describe("cuentas", { concurrency: false }, () => {
  test("el alta entra en Junior y abre hasta tres lecturas", async () => {
    const dir = await sandbox();
    try {
      const created = await registerUser({
        email: "Ana@Ejemplo.pe",
        name: "Ana Pérez",
        password: "clave-junior",
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      assert.equal(created.value.plan, "junior");
      assert.equal(created.value.email, "ana@ejemplo.pe");
      for (let index = 0; index < 3; index += 1) {
        const opened = await consumeRtf(created.value.id, `2019_5_${index}`);
        assert.equal(opened.ok, true);
      }
      const blocked = await consumeRtf(created.value.id, "2019_5_extra");
      assert.equal(blocked.ok, false);
      const again = await registerUser({ email: "ana@ejemplo.pe", name: "Ana Pérez", password: "clave-junior" });
      assert.equal(again.ok, false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("Senior permite 30 resoluciones distintas al mes y el mes siguiente empieza de cero", async () => {
    const dir = await sandbox();
    try {
      const created = await registerUser({ email: "senior@ejemplo.pe", name: "Luis Senior", password: "clave-senior" });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const january = new Date("2026-01-15T18:00:00Z");
      const assigned = await assignPlan(created.value.id, "senior", january);
      assert.equal(assigned.ok, true);
      for (let index = 0; index < 30; index += 1) {
        const opened = await consumeRtf(created.value.id, `2019_5_${index}`, january);
        assert.equal(opened.ok, true);
      }
      const repeat = await consumeRtf(created.value.id, "2019_5_0", january);
      assert.equal(repeat.ok, true);
      if (repeat.ok) assert.equal(repeat.counted, false);
      const blocked = await consumeRtf(created.value.id, "2019_5_extra", january);
      assert.equal(blocked.ok, false);
      const february = await consumeRtf(created.value.id, "2019_5_extra", new Date("2026-02-15T18:00:00Z"));
      assert.equal(february.ok, true);
      if (february.ok) assert.equal(february.remaining, 29);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("la solicitud de pago se activa desde administración y el cupo se puede reiniciar", async () => {
    const dir = await sandbox();
    try {
      const created = await registerUser({ email: "pago@ejemplo.pe", name: "Nuria Pago", password: "clave-pago-1" });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const asked = await requestPlan(created.value.id, "gerente", "anual");
      assert.equal(asked.ok, true);
      const pending = await getUser(created.value.id);
      assert.equal(pending?.pendingPlan, "gerente");
      assert.equal(pending?.pendingCycle, "anual");
      const active = await confirmPendingPlan(created.value.id);
      assert.equal(active.ok, true);
      if (!active.ok) return;
      assert.equal(active.value.plan, "gerente");
      assert.equal(active.value.pendingPlan, null);
      await consumeRtf(created.value.id, "2020_10_00975");
      const reset = await resetUsage(created.value.id);
      assert.equal(reset.ok, true);
      if (reset.ok) assert.equal(reset.value.rtfOpens, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("el primer administrador queda en Socio y su clave no viaja en el código", async () => {
    const dir = await sandbox();
    try {
      const first = await ensureAdmin();
      const second = await ensureAdmin();
      assert.equal(first.created, true);
      assert.equal(second.created, false);
      const note = await readFile(adminNotePath(), "utf8");
      const password = note.match(/Contraseña: (\S+)/)?.[1];
      assert.ok(password);
      const session = await loginUser("admin@tribunalfiscal.pe", password || "");
      assert.equal(session.ok, true);
      if (!session.ok) return;
      assert.equal(session.value.role, "admin");
      assert.equal(session.value.plan, "socio");
      const wrong = await loginUser("admin@tribunalfiscal.pe", "no-es-la-clave");
      assert.equal(wrong.ok, false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("el correo universitario confirma cinco lecturas por un año", async () => {
    const dir = await sandbox();
    try {
      const rejected = await registerUser({
        email: "ana@gmail.com",
        name: "Ana Gómez",
        password: "clave-estudiante",
        student: true,
      });
      assert.equal(rejected.ok, false);
      const created = await registerUser({
        email: "ana@pucp.edu.pe",
        name: "Ana Gómez",
        password: "clave-estudiante",
        student: true,
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      assert.equal(created.value.plan, "estudiante");
      assert.equal(created.value.studentUntil, null);
      const blocked = await consumeRtf(created.value.id, "2019_5_11125");
      assert.equal(blocked.ok, false);
      const token = await readStudentConfirmToken(created.value.id);
      assert.ok(token);
      const confirmed = await confirmStudentByToken(token || "");
      assert.equal(confirmed.ok, true);
      if (!confirmed.ok) return;
      assert.ok(confirmed.value.studentUntil);
      for (let index = 0; index < 5; index += 1) {
        const opened = await consumeRtf(created.value.id, `2019_5_${index}`);
        assert.equal(opened.ok, true);
      }
      const extra = await consumeRtf(created.value.id, "2019_5_extra");
      assert.equal(extra.ok, false);
      const again = await beginStudentConfirmation(created.value.id);
      assert.equal(again.ok, true);
      const after = await getUser(created.value.id);
      assert.equal(after?.studentUntil, null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("administración puede crear una cuenta en un plan de pago", async () => {
    const dir = await sandbox();
    try {
      const created = await createUser({
        email: "socio@ejemplo.pe",
        name: "Eva Socio",
        password: "clave-socio",
        plan: "socio",
        role: "user",
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const opened = await consumeRtf(created.value.id, "2019_5_11125");
      assert.equal(opened.ok, true);
      if (opened.ok) assert.equal(opened.remaining, null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("el perfil guarda datos y la tarjeta solo los últimos 4", async () => {
    const dir = await sandbox();
    try {
      const created = await registerUser({
        email: "ana.torres@estudiotorres.pe",
        name: "Ana Torres",
        password: "clave-perfil",
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const saved = await saveProfile(created.value.id, {
        givenNames: "Ana Lucía",
        surnames: "Torres Salinas",
        docType: "DNI",
        docNumber: "45879213",
        phone: "+51 987 654 321",
        studentEmail: "",
        profession: "abogado",
        licenseNumber: "CAL 78421",
        firm: "Estudio Torres",
        jobTitle: "Asociada senior",
        specialty: "IGV",
        receipt: "factura",
        ruc: "20601234567",
        legalName: "ESTUDIO TORRES ABOGADOS S.A.C.",
        fiscalAddress: "Av. Javier Prado Este 492",
        twitter: "@usuario",
        facebook: "",
        website: "estudiotorres.pe",
        shareCv: false,
        email: "ana.torres@estudiotorres.pe",
        confirmPhone: true,
      });
      assert.equal(saved.ok, true);
      const card = await addCard(created.value.id, "visa", "4821", "08/29");
      assert.equal(card.ok, true);
      const refused = await addCard(created.value.id, "visa", "4111111111114821", "08/29");
      assert.equal(refused.ok, false);
      const opened = await consumeRtf(created.value.id, "2019_5_11125", new Date(), "Decisión 578");
      assert.equal(opened.ok, true);
      const account = await getAccount(created.value.id);
      assert.equal(account?.name, "Ana Lucía Torres Salinas");
      assert.equal(account?.profile.phoneConfirmed, true);
      assert.equal(account?.cards[0]?.last4, "4821");
      assert.equal(account?.cards[0]?.brand, "visa");
      assert.equal(JSON.stringify(account?.cards).includes("4111"), false);
      assert.equal(account?.readings[0]?.criterion, "Decisión 578");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

async function sandbox(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "tf-cuentas-"));
  process.env.TF_DATA_DIR = dir;
  return dir;
}
