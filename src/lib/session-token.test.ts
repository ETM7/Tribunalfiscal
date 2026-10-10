import assert from "node:assert/strict";
import test from "node:test";
import { openSession, sealSession } from "./session-token";

test("la cookie firmada identifica al usuario y rechaza una firma ajena", () => {
  const now = Date.parse("2026-10-05T15:00:00Z");
  const token = sealSession("usuario-1", "secreto-de-prueba", now);
  assert.equal(openSession(token, "secreto-de-prueba", now), "usuario-1");
  assert.equal(openSession(token, "otro-secreto", now), null);
  assert.equal(openSession(`${token}x`, "secreto-de-prueba", now), null);
  assert.equal(openSession(token, "secreto-de-prueba", now + 15 * 24 * 60 * 60 * 1000), null);
});
