import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isPlanId, limaMonth, PLANS, type PlanId } from "./plans";

const SCRYPT_N = 16384;

function deriveKey(password: string, salt: Buffer, keylen: number, rounds: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, { N: rounds, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export type Role = "user" | "admin";

type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  plan: PlanId;
  pendingPlan: PlanId | null;
  usageMonth: string;
  openedIds: string[];
  createdAt: string;
};

type Store = { users: StoredUser[] };

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  plan: PlanId;
  pendingPlan: PlanId | null;
  usageMonth: string;
  rtfOpens: number;
  createdAt: string;
};

export type AccountResult<T> = { ok: true; value: T } | { ok: false; message: string };

const queues = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  queues.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export function dataDir(): string {
  return process.env.TF_DATA_DIR || path.join(process.cwd(), "data");
}

function usersPath(): string {
  return path.join(dataDir(), "usuarios.json");
}

function secretPath(): string {
  return path.join(dataDir(), "secreto");
}

export function adminNotePath(): string {
  return path.join(dataDir(), "admin-inicial.txt");
}

async function ensureDir(): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
}

export async function readSecret(): Promise<string> {
  return withLock(`${dataDir()}:secreto`, async () => {
    await ensureDir();
    try {
      const existing = (await readFile(secretPath(), "utf8")).trim();
      if (existing.length >= 32) return existing;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const secret = randomBytes(32).toString("hex");
    await writeFile(secretPath(), `${secret}\n`, { mode: 0o600 });
    return secret;
  });
}

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(usersPath(), "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || !Array.isArray(parsed.users)) throw new Error("El archivo de cuentas está dañado.");
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { users: [] };
    throw error;
  }
}

async function writeStore(store: Store): Promise<void> {
  await ensureDir();
  const destination = usersPath();
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, destination);
}

function toPublic(user: StoredUser, now = new Date()): PublicUser {
  const month = limaMonth(now);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    pendingPlan: user.pendingPlan,
    usageMonth: month,
    rtfOpens: user.usageMonth === month ? user.openedIds.length : 0,
    createdAt: user.createdAt,
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

function cleanName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

function cleanPassword(value: string): string | null {
  if (value.length < 8 || value.length > 80) return null;
  return value;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, 32, SCRYPT_N);
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, rounds, saltHex, hashHex] = stored.split("$");
  if (kind !== "scrypt" || !rounds || !saltHex || !hashHex) return false;
  const n = Number(rounds);
  if (!Number.isInteger(n) || n < 2) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"), expected.length, n);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function freshUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  plan: PlanId;
  now: Date;
}): StoredUser {
  return {
    id: randomBytes(12).toString("hex"),
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
    role: input.role,
    plan: input.plan,
    pendingPlan: null,
    usageMonth: limaMonth(input.now),
    openedIds: [],
    createdAt: input.now.toISOString(),
  };
}

function rollMonth(user: StoredUser, now: Date): void {
  const month = limaMonth(now);
  if (user.usageMonth === month) return;
  user.usageMonth = month;
  user.openedIds = [];
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
  now?: Date;
}): Promise<AccountResult<PublicUser>> {
  const email = normalizeEmail(input.email);
  const name = cleanName(input.name);
  const password = cleanPassword(input.password);
  if (!validEmail(email)) return { ok: false, message: "Escribe un correo válido." };
  if (!name) return { ok: false, message: "El nombre necesita entre 2 y 80 caracteres." };
  if (!password) return { ok: false, message: "La contraseña necesita entre 8 y 80 caracteres." };
  const now = input.now ?? new Date();
  const passwordHash = await hashPassword(password);
  return withLock(dataDir(), async () => {
    const store = await readStore();
    if (store.users.some((user) => user.email === email)) {
      return { ok: false, message: "Ese correo ya tiene una cuenta." };
    }
    const user = freshUser({ email, name, passwordHash, role: "user", plan: "junior", now });
    store.users.push(user);
    await writeStore(store);
    return { ok: true, value: toPublic(user, now) };
  });
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  plan: string;
  role: Role;
  now?: Date;
}): Promise<AccountResult<PublicUser>> {
  const plan = input.plan;
  if (!isPlanId(plan)) return { ok: false, message: "Ese plan no existe." };
  const email = normalizeEmail(input.email);
  const name = cleanName(input.name);
  const password = cleanPassword(input.password);
  if (!validEmail(email)) return { ok: false, message: "Escribe un correo válido." };
  if (!name) return { ok: false, message: "El nombre necesita entre 2 y 80 caracteres." };
  if (!password) return { ok: false, message: "La contraseña necesita entre 8 y 80 caracteres." };
  const now = input.now ?? new Date();
  const passwordHash = await hashPassword(password);
  return withLock(dataDir(), async () => {
    const store = await readStore();
    if (store.users.some((user) => user.email === email)) {
      return { ok: false, message: "Ese correo ya tiene una cuenta." };
    }
    const user = freshUser({ email, name, passwordHash, role: input.role, plan, now });
    store.users.push(user);
    await writeStore(store);
    return { ok: true, value: toPublic(user, now) };
  });
}

export async function loginUser(emailRaw: string, password: string): Promise<AccountResult<PublicUser>> {
  const email = normalizeEmail(emailRaw);
  const store = await withLock(dataDir(), () => readStore());
  const user = store.users.find((item) => item.email === email);
  const matches = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !matches) return { ok: false, message: "Correo o contraseña incorrectos." };
  return { ok: true, value: toPublic(user) };
}

export async function getUser(id: string): Promise<PublicUser | null> {
  const store = await withLock(dataDir(), () => readStore());
  const user = store.users.find((item) => item.id === id);
  return user ? toPublic(user) : null;
}

export async function listUsers(now = new Date()): Promise<PublicUser[]> {
  const store = await withLock(dataDir(), () => readStore());
  return store.users
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((user) => toPublic(user, now));
}

export async function ensureAdmin(now = new Date()): Promise<{ created: boolean; email: string }> {
  const email = "admin@tribunalfiscal.pe";
  return withLock(dataDir(), async () => {
    const store = await readStore();
    if (store.users.some((user) => user.role === "admin")) return { created: false, email };
    const password = randomBytes(12).toString("base64url");
    const user = freshUser({
      email,
      name: "Administrador",
      passwordHash: await hashPassword(password),
      role: "admin",
      plan: "socio",
      now,
    });
    store.users.push(user);
    await writeStore(store);
    await writeFile(
      adminNotePath(),
      ["Primer administrador de Tribunalfiscal", `Correo: ${email}`, `Contraseña: ${password}`, "Este archivo no se sube a git. Cámbiala desde el portal.", ""].join("\n"),
      { mode: 0o600 },
    );
    return { created: true, email };
  });
}

export async function requestPlan(userId: string, plan: string): Promise<AccountResult<PlanId>> {
  if (!isPlanId(plan)) return { ok: false, message: "Ese plan no existe." };
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    if (user.plan === plan) return { ok: false, message: "Ese ya es tu plan." };
    user.pendingPlan = plan;
    await writeStore(store);
    return { ok: true, value: plan };
  });
}

export async function assignPlan(userId: string, plan: string, now = new Date()): Promise<AccountResult<PublicUser>> {
  if (!isPlanId(plan)) return { ok: false, message: "Ese plan no existe." };
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    user.plan = plan;
    user.pendingPlan = null;
    rollMonth(user, now);
    await writeStore(store);
    return { ok: true, value: toPublic(user, now) };
  });
}

export async function confirmPendingPlan(userId: string, now = new Date()): Promise<AccountResult<PublicUser>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    if (!user.pendingPlan) return { ok: false, message: "No hay un plan pendiente de pago." };
    user.plan = user.pendingPlan;
    user.pendingPlan = null;
    rollMonth(user, now);
    await writeStore(store);
    return { ok: true, value: toPublic(user, now) };
  });
}

export async function resetUsage(userId: string, now = new Date()): Promise<AccountResult<PublicUser>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    user.usageMonth = limaMonth(now);
    user.openedIds = [];
    await writeStore(store);
    return { ok: true, value: toPublic(user, now) };
  });
}

export async function changePassword(
  userId: string,
  current: string,
  next: string,
): Promise<AccountResult<true>> {
  const password = cleanPassword(next);
  if (!password) return { ok: false, message: "La contraseña nueva necesita entre 8 y 80 caracteres." };
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    if (!(await verifyPassword(current, user.passwordHash))) {
      return { ok: false, message: "La contraseña actual no coincide." };
    }
    user.passwordHash = await hashPassword(password);
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function consumeRtf(
  userId: string | null,
  resolutionId: string,
  now = new Date(),
): Promise<{ ok: true; counted: boolean; remaining: number | null } | { ok: false; message: string }> {
  const resolution = resolutionId.trim().slice(0, 120);
  if (!userId) {
    return {
      ok: false,
      message: "Entra al portal para abrir el RTF editable. El plan Junior permite buscar, sin ese botón.",
    };
  }
  if (!resolution) return { ok: false, message: "Falta el expediente." };

  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "La sesión ya no corresponde a una cuenta." };
    rollMonth(user, now);
    const plan = PLANS[user.plan];
    const already = user.openedIds.includes(resolution);
    if (plan.rtfLimit === 0) {
      await writeStore(store);
      return { ok: false, message: "El plan Junior permite buscar, sin acceso al RTF editable." };
    }
    if (!already && plan.rtfLimit !== null && user.openedIds.length >= plan.rtfLimit) {
      await writeStore(store);
      return {
        ok: false,
        message: `Este mes ya usaste las ${plan.rtfLimit} consultas al RTF editable del plan ${plan.name}.`,
      };
    }
    if (!already) user.openedIds.push(resolution);
    await writeStore(store);
    const remaining = plan.rtfLimit === null ? null : plan.rtfLimit - user.openedIds.length;
    return { ok: true, counted: !already, remaining };
  });
}

export async function releaseRtf(userId: string, resolutionId: string, now = new Date()): Promise<void> {
  const resolution = resolutionId.trim().slice(0, 120);
  if (!resolution) return;
  await withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user || user.usageMonth !== limaMonth(now)) return;
    user.openedIds = user.openedIds.filter((item) => item !== resolution);
    await writeStore(store);
  });
}
