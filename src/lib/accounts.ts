import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  emptyProfile,
  monthOfIso,
  monthTitle,
  normalizeProfile,
  parseCardInput,
  toPublicProfile,
  type LinkedInLink,
  type Movement,
  type PayCard,
  type Profile,
  type PublicProfile,
  type ReadingLog,
  type SearchLog,
} from "./profile";
import { isBillingCycle, isEduPeEmail, isPlanId, limaMonth, PLANS, plusOneYear, type BillingCycle, type PlanId } from "./plans";

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
  pendingCycle?: BillingCycle | null;
  studentUntil?: string | null;
  confirmToken?: string | null;
  usageMonth: string;
  openedIds: string[];
  createdAt: string;
  profile?: Profile;
  linkedin?: LinkedInLink | null;
  cards?: PayCard[];
  movements?: Movement[];
  readings?: ReadingLog[];
  searches?: SearchLog[];
  autoRenew?: boolean;
  pendingEmail?: string | null;
  emailToken?: string | null;
};

export type AccountDetail = PublicUser & {
  profile: PublicProfile;
  linkedin: LinkedInLink | null;
  cards: PayCard[];
  movements: Movement[];
  readings: ReadingLog[];
  searches: SearchLog[];
  autoRenew: boolean;
  pendingEmail: string | null;
};

type Store = { users: StoredUser[] };

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  plan: PlanId;
  pendingPlan: PlanId | null;
  pendingCycle: BillingCycle | null;
  studentUntil: string | null;
  usageMonth: string;
  rtfOpens: number;
  openedIds: string[];
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
    pendingCycle: user.pendingPlan ? (user.pendingCycle === "anual" ? "anual" : "mensual") : null,
    studentUntil: user.studentUntil ?? null,
    usageMonth: month,
    rtfOpens: user.usageMonth === month ? user.openedIds.length : 0,
    openedIds: user.usageMonth === month ? [...user.openedIds] : [],
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
    pendingCycle: null,
    studentUntil: null,
    confirmToken: null,
    usageMonth: limaMonth(input.now),
    openedIds: [],
    createdAt: input.now.toISOString(),
    profile: emptyProfile(),
    linkedin: null,
    cards: [],
    movements: [],
    readings: [],
    searches: [],
    autoRenew: true,
    pendingEmail: null,
    emailToken: null,
  };
}

function studentWindowOpen(user: StoredUser, now: Date): boolean {
  if (!user.studentUntil) return false;
  const until = new Date(user.studentUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > now.getTime();
}

function applyStudentWindow(user: StoredUser, plan: PlanId, now: Date): void {
  if (plan === "estudiante") {
    user.studentUntil = plusOneYear(now);
    user.confirmToken = null;
    return;
  }
  user.studentUntil = null;
  user.confirmToken = null;
}

function rollMonth(user: StoredUser, now: Date): void {
  const month = limaMonth(now);
  if (user.usageMonth === month) return;
  user.usageMonth = month;
  user.openedIds = [];
}

function ensureAccount(user: StoredUser): void {
  user.profile = normalizeProfile(user.profile);
  user.cards = Array.isArray(user.cards) ? user.cards : [];
  user.movements = Array.isArray(user.movements) ? user.movements : [];
  user.readings = Array.isArray(user.readings) ? user.readings : [];
  user.searches = Array.isArray(user.searches) ? user.searches : [];
  if (typeof user.autoRenew !== "boolean") user.autoRenew = true;
  user.linkedin = user.linkedin?.name ? user.linkedin : null;
  user.pendingEmail = user.pendingEmail || null;
  user.emailToken = user.emailToken || null;
}

function detailOf(user: StoredUser, now = new Date()): AccountDetail {
  ensureAccount(user);
  const profile = user.profile ?? emptyProfile();
  return {
    ...toPublic(user, now),
    profile: toPublicProfile(profile),
    linkedin: user.linkedin ?? null,
    cards: user.cards ?? [],
    movements: user.movements ?? [],
    readings: user.readings ?? [],
    searches: user.searches ?? [],
    autoRenew: user.autoRenew !== false,
    pendingEmail: user.pendingEmail ?? null,
  };
}

function recordMovement(user: StoredUser, plan: PlanId, now: Date): void {
  const price = PLANS[plan].priceSoles;
  if (price <= 0) return;
  ensureAccount(user);
  const card = user.cards?.find((item) => item.principal) ?? user.cards?.[0];
  const [year, month] = limaMonth(now).split("-");
  const label = monthTitle(`${year}-${month}`).replace(` ${year}`, "").toLocaleLowerCase("es-PE");
  const serial = (randomBytes(3).readUIntBE(0, 3) % 900000) + 100000;
  user.movements?.unshift({
    id: randomBytes(6).toString("hex"),
    at: now.toISOString(),
    concept: `${PLANS[plan].name} · ${label} ${year}`,
    brand: card?.brand ?? "",
    last4: card?.last4 ?? "",
    receipt: `F001-${serial}`,
    amountSoles: price,
    status: "pagado",
  });
  user.movements = (user.movements ?? []).slice(0, 120);
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
  student?: boolean;
  now?: Date;
}): Promise<AccountResult<PublicUser>> {
  const email = normalizeEmail(input.email);
  const name = cleanName(input.name);
  const password = cleanPassword(input.password);
  if (!validEmail(email)) return { ok: false, message: "Escribe un correo válido." };
  if (!name) return { ok: false, message: "El nombre necesita entre 2 y 80 caracteres." };
  if (!password) return { ok: false, message: "La contraseña necesita entre 8 y 80 caracteres." };
  if (input.student && !isEduPeEmail(email)) {
    return { ok: false, message: "Usa el correo que te dio tu universidad. Tiene que terminar en edu.pe." };
  }
  const now = input.now ?? new Date();
  const passwordHash = await hashPassword(password);
  return withLock(dataDir(), async () => {
    const store = await readStore();
    if (store.users.some((user) => user.email === email)) {
      return { ok: false, message: "Ese correo ya tiene una cuenta." };
    }
    const user = freshUser({
      email,
      name,
      passwordHash,
      role: "user",
      plan: input.student ? "estudiante" : "junior",
      now,
    });
    if (input.student) user.confirmToken = randomBytes(24).toString("hex");
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

export async function requestPlan(
  userId: string,
  plan: string,
  cycle: BillingCycle = "mensual",
): Promise<AccountResult<PlanId>> {
  if (!isPlanId(plan)) return { ok: false, message: "Ese plan no existe." };
  const billing = isBillingCycle(cycle) ? cycle : "mensual";
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    if (user.plan === plan) return { ok: false, message: "Ese ya es tu plan." };
    user.pendingPlan = plan;
    user.pendingCycle = PLANS[plan].priceSoles === 0 ? "mensual" : billing;
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
    const previous = user.plan;
    user.plan = plan;
    user.pendingPlan = null;
    user.pendingCycle = null;
    if (previous !== plan) recordMovement(user, plan, now);
    applyStudentWindow(user, plan, now);
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
    const nextPlan = user.pendingPlan;
    const previous = user.plan;
    user.plan = nextPlan;
    user.pendingPlan = null;
    user.pendingCycle = null;
    if (previous !== nextPlan) recordMovement(user, nextPlan, now);
    applyStudentWindow(user, nextPlan, now);
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

export async function readStudentConfirmToken(userId: string): Promise<string | null> {
  const store = await withLock(dataDir(), () => readStore());
  const user = store.users.find((item) => item.id === userId);
  return user?.confirmToken || null;
}

export async function confirmStudentByToken(
  token: string,
  now = new Date(),
): Promise<AccountResult<PublicUser>> {
  const clean = token.trim();
  if (!clean) return { ok: false, message: "El enlace de confirmación no es válido." };
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.confirmToken === clean);
    if (!user) return { ok: false, message: "El enlace de confirmación no es válido o ya se usó." };
    ensureAccount(user);
    const studentMail = user.profile?.studentEmail || user.email;
    if (!isEduPeEmail(studentMail)) {
      return { ok: false, message: "El enlace de confirmación no es válido o ya se usó." };
    }
    user.plan = "estudiante";
    user.studentUntil = plusOneYear(now);
    user.confirmToken = null;
    await writeStore(store);
    return { ok: true, value: toPublic(user, now) };
  });
}

export async function beginStudentConfirmation(userId: string): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    if (!isEduPeEmail(user.email)) {
      return { ok: false, message: "Usa el correo que te dio tu universidad. Tiene que terminar en edu.pe." };
    }
    if (user.plan === "senior" || user.plan === "gerente" || user.plan === "socio") {
      return { ok: false, message: "Tu plan ya incluye más lecturas que el de estudiante." };
    }
    user.plan = "estudiante";
    user.studentUntil = null;
    user.confirmToken = randomBytes(24).toString("hex");
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function consumeRtf(
  userId: string | null,
  resolutionId: string,
  now = new Date(),
  criterion = "",
): Promise<{ ok: true; counted: boolean; remaining: number | null } | { ok: false; message: string }> {
  const resolution = resolutionId.trim().slice(0, 120);
  if (!userId) {
    return {
      ok: false,
      message: "Entra al portal para abrir el RTF editable. El plan Junior es gratis e incluye 3 lecturas al mes.",
    };
  }
  if (!resolution) return { ok: false, message: "Falta el expediente." };

  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "La sesión ya no corresponde a una cuenta." };
    rollMonth(user, now);
    const plan = PLANS[user.plan];
    if (user.plan === "estudiante" && !studentWindowOpen(user, now)) {
      await writeStore(store);
      return {
        ok: false,
        message: user.studentUntil
          ? "El beneficio de estudiante venció. Hay que revalidarlo en el portal."
          : "Confirma el enlace de tu correo de estudiante para usar las 5 lecturas.",
      };
    }
    ensureAccount(user);
    const note = criterion.trim().replace(/\s+/g, " ").slice(0, 160);
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
    if (!already) {
      user.openedIds.push(resolution);
      user.readings?.unshift({
        at: now.toISOString(),
        resolutionId: resolution,
        criterion: note,
        downloaded: false,
      });
      user.readings = (user.readings ?? []).slice(0, 400);
    } else if (note) {
      const row = user.readings?.find((item) => item.resolutionId === resolution && !item.criterion);
      if (row) row.criterion = note;
    }
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
    const month = limaMonth(now);
    user.readings = (user.readings ?? []).filter(
      (item) => !(item.resolutionId === resolution && monthOfIso(item.at) === month),
    );
    await writeStore(store);
  });
}

export async function getAccount(id: string, now = new Date()): Promise<AccountDetail | null> {
  const store = await withLock(dataDir(), () => readStore());
  const user = store.users.find((item) => item.id === id);
  return user ? detailOf(user, now) : null;
}

export type ProfileInput = {
  givenNames: string;
  surnames: string;
  docType: string;
  docNumber: string;
  phone: string;
  studentEmail: string;
  profession: string;
  licenseNumber: string;
  firm: string;
  jobTitle: string;
  specialty: string;
  receipt: string;
  ruc: string;
  legalName: string;
  fiscalAddress: string;
  twitter: string;
  facebook: string;
  website: string;
  shareCv: boolean;
  email: string;
  confirmPhone: boolean;
};

function cleanPhone(value: string): string | null {
  const phone = value.replace(/\s+/g, " ").trim();
  if (!phone) return "";
  if (!/^\+?[0-9][0-9 -]{5,18}$/.test(phone)) return null;
  return phone.slice(0, 20);
}

export async function saveProfile(
  userId: string,
  input: ProfileInput,
): Promise<AccountResult<{ emailToken: string | null }>> {
  const phone = cleanPhone(input.phone);
  if (phone === null) return { ok: false, message: "El celular no parece válido." };
  if (input.confirmPhone && !phone) return { ok: false, message: "Escribe un celular para confirmarlo." };
  const studentEmail = normalizeEmail(input.studentEmail);
  if (studentEmail && !isEduPeEmail(studentEmail)) {
    return { ok: false, message: "El correo de estudiante tiene que terminar en edu.pe." };
  }
  if (studentEmail && !validEmail(studentEmail)) return { ok: false, message: "El correo de estudiante no es válido." };
  const nextEmail = normalizeEmail(input.email);
  if (!validEmail(nextEmail)) return { ok: false, message: "Escribe un correo válido." };
  const receipt = input.receipt === "factura" ? "factura" : "boleta";
  const ruc = input.ruc.replace(/\D/g, "").slice(0, 11);
  if (receipt === "factura" && ruc.length !== 11) return { ok: false, message: "El RUC de la factura necesita 11 dígitos." };

  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    if (store.users.some((item) => item.email === nextEmail && item.id !== user.id)) {
      return { ok: false, message: "Ese correo ya tiene una cuenta." };
    }
    const profile = user.profile ?? emptyProfile();
    const phoneChanged = phone !== profile.phone;
    profile.givenNames = input.givenNames;
    profile.surnames = input.surnames;
    profile.docType = input.docType === "CE" || input.docType === "Pasaporte" ? input.docType : "DNI";
    profile.docNumber = input.docNumber;
    profile.phone = phone;
    profile.phoneConfirmed = input.confirmPhone && Boolean(phone) ? true : phoneChanged ? false : profile.phoneConfirmed;
    const previousStudent = profile.studentEmail;
    profile.studentEmail = studentEmail;
    profile.profession = input.profession;
    profile.licenseNumber = input.licenseNumber;
    profile.firm = input.firm;
    profile.jobTitle = input.jobTitle;
    profile.specialty = input.specialty;
    profile.receipt = receipt;
    profile.ruc = ruc;
    profile.legalName = input.legalName;
    profile.fiscalAddress = input.fiscalAddress;
    profile.twitter = input.twitter.replace(/^@/, "");
    profile.facebook = input.facebook;
    profile.website = input.website;
    profile.shareCv = input.shareCv;
    user.profile = normalizeProfile(profile);
    const full = `${user.profile.givenNames} ${user.profile.surnames}`.trim();
    if (full.length >= 2 && full.length <= 80) user.name = full;
    if (nextEmail === user.email) {
      user.pendingEmail = null;
      user.emailToken = null;
    } else {
      user.pendingEmail = nextEmail;
      user.emailToken = randomBytes(24).toString("hex");
    }
    if (studentEmail && studentEmail !== previousStudent) user.confirmToken = randomBytes(24).toString("hex");
    if (!studentEmail && !isEduPeEmail(user.email)) user.confirmToken = null;
    await writeStore(store);
    return { ok: true, value: { emailToken: user.emailToken ?? null } };
  });
}

export async function confirmEmailByToken(token: string): Promise<AccountResult<true>> {
  const clean = token.trim();
  if (!clean) return { ok: false, message: "El enlace de confirmación no es válido." };
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.emailToken === clean && item.pendingEmail);
    if (!user || !user.pendingEmail) return { ok: false, message: "El enlace de confirmación no es válido o ya se usó." };
    if (store.users.some((item) => item.email === user.pendingEmail && item.id !== user.id)) {
      return { ok: false, message: "Ese correo ya tiene otra cuenta." };
    }
    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailToken = null;
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function readEmailConfirmToken(userId: string): Promise<string | null> {
  const store = await withLock(dataDir(), () => readStore());
  const user = store.users.find((item) => item.id === userId);
  return user?.emailToken || null;
}

function profileDir(userId: string): string {
  if (!/^[a-f0-9]{24}$/.test(userId)) throw new Error("Cuenta inválida.");
  return path.join(dataDir(), "perfiles", userId);
}

function imageName(bytes: Buffer): "foto.jpg" | "foto.png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "foto.jpg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "foto.png";
  return null;
}

export async function savePhoto(userId: string, bytes: Buffer): Promise<AccountResult<true>> {
  if (bytes.length === 0) return { ok: true, value: true };
  if (bytes.length > 2 * 1024 * 1024) return { ok: false, message: "La foto pasa de 2 MB." };
  const filename = imageName(bytes);
  if (!filename) return { ok: false, message: "La foto tiene que ser JPG o PNG." };
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    await mkdir(profileDir(userId), { recursive: true });
    await writeFile(path.join(profileDir(userId), filename), bytes, { mode: 0o600 });
    if (user.profile && user.profile.photoFile && user.profile.photoFile !== filename) {
      await rm(path.join(profileDir(userId), user.profile.photoFile), { force: true });
    }
    if (user.profile) user.profile.photoFile = filename;
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function removePhoto(userId: string): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    if (user.profile?.photoFile) await rm(path.join(profileDir(userId), user.profile.photoFile), { force: true });
    if (user.profile) user.profile.photoFile = null;
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function saveCv(userId: string, bytes: Buffer, originalName: string): Promise<AccountResult<true>> {
  if (bytes.length === 0) return { ok: true, value: true };
  if (bytes.length > 5 * 1024 * 1024) return { ok: false, message: "El CV pasa de 5 MB." };
  const lower = originalName.toLowerCase();
  const pdf = bytes.subarray(0, 4).toString() === "%PDF" && lower.endsWith(".pdf");
  const docx = bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4b && lower.endsWith(".docx");
  const doc = bytes.length > 2 && bytes[0] === 0xd0 && bytes[1] === 0xcf && lower.endsWith(".doc");
  if (!pdf && !docx && !doc) return { ok: false, message: "El CV tiene que ser PDF o Word." };
  const safeName = originalName.replace(/[^\w.\- ]+/g, "").trim().slice(0, 80) || "cv.pdf";
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    await mkdir(profileDir(userId), { recursive: true });
    await writeFile(path.join(profileDir(userId), "cv.bin"), bytes, { mode: 0o600 });
    if (user.profile) {
      user.profile.cvFile = "cv.bin";
      user.profile.cvName = safeName;
      user.profile.cvBytes = bytes.length;
      user.profile.cvUploadedAt = new Date().toISOString();
    }
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function removeCv(userId: string): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    await rm(path.join(profileDir(userId), "cv.bin"), { force: true });
    if (user.profile) {
      user.profile.cvFile = null;
      user.profile.cvName = "";
      user.profile.cvBytes = 0;
      user.profile.cvUploadedAt = null;
    }
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function readProfileFile(
  userId: string,
  kind: "foto" | "cv",
): Promise<{ bytes: Buffer; filename: string; type: string } | null> {
  const store = await withLock(dataDir(), () => readStore());
  const user = store.users.find((item) => item.id === userId);
  if (!user) return null;
  ensureAccount(user);
  if (kind === "foto" && user.profile?.photoFile) {
    const filename = user.profile.photoFile;
    const bytes = await readFile(path.join(profileDir(userId), filename));
    return { bytes, filename, type: filename.endsWith(".png") ? "image/png" : "image/jpeg" };
  }
  if (kind === "cv" && user.profile?.cvFile) {
    const bytes = await readFile(path.join(profileDir(userId), "cv.bin"));
    const name = user.profile.cvName || "cv.pdf";
    const type = name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return { bytes, filename: name, type };
  }
  return null;
}

export async function connectLinkedIn(userId: string): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    const profile = user.profile ?? emptyProfile();
    const name = `${profile.givenNames} ${profile.surnames}`.trim() || user.name;
    user.linkedin = { name, email: user.email };
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function disconnectLinkedIn(userId: string): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    user.linkedin = null;
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function importLinkedIn(userId: string): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user?.linkedin?.name) return { ok: false, message: "Primero conecta LinkedIn." };
    ensureAccount(user);
    const parts = user.linkedin.name.trim().split(/\s+/).filter(Boolean);
    const profile = user.profile ?? emptyProfile();
    if (parts.length >= 2) {
      profile.givenNames = parts.length > 3 ? parts.slice(0, -2).join(" ") : parts.length === 3 ? parts[0] : parts[0];
      profile.surnames = parts.length >= 3 ? parts.slice(-2).join(" ") : parts[1];
      user.profile = normalizeProfile(profile);
      const full = `${user.profile.givenNames} ${user.profile.surnames}`.trim();
      if (full.length >= 2) user.name = full.slice(0, 80);
    }
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function addCard(
  userId: string,
  brand: string,
  last4: string,
  expiry: string,
): Promise<AccountResult<true>> {
  const parsed = parseCardInput(brand, last4, expiry);
  if (!parsed.ok) return parsed;
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    const cards = user.cards ?? [];
    if (cards.length >= 4) return { ok: false, message: "Puedes guardar hasta 4 tarjetas." };
    if (cards.some((item) => item.last4 === parsed.value.last4 && item.brand === parsed.value.brand)) {
      return { ok: false, message: "Esa tarjeta ya está guardada." };
    }
    cards.push({
      id: randomBytes(6).toString("hex"),
      brand: parsed.value.brand,
      last4: parsed.value.last4,
      expiry: parsed.value.expiry,
      principal: cards.length === 0,
    });
    user.cards = cards;
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function useCard(userId: string, cardId: string): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    const cards = user.cards ?? [];
    if (!cards.some((item) => item.id === cardId)) return { ok: false, message: "No encuentro esa tarjeta." };
    for (const card of cards) card.principal = card.id === cardId;
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function removeCard(userId: string, cardId: string): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    ensureAccount(user);
    const cards = (user.cards ?? []).filter((item) => item.id !== cardId);
    if (!cards.some((item) => item.principal) && cards[0]) cards[0].principal = true;
    user.cards = cards;
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function setAutoRenew(userId: string, active: boolean): Promise<AccountResult<true>> {
  return withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return { ok: false, message: "No encuentro esa cuenta." };
    user.autoRenew = active;
    await writeStore(store);
    return { ok: true, value: true };
  });
}

export async function logSearch(userId: string, query: string, now = new Date()): Promise<void> {
  const text = query.trim().replace(/\s+/g, " ").slice(0, 160);
  if (text.length < 2) return;
  await withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return;
    ensureAccount(user);
    const last = user.searches?.[0];
    if (last && last.query === text && now.getTime() - new Date(last.at).getTime() < 2 * 60 * 1000) return;
    user.searches?.unshift({ at: now.toISOString(), query: text });
    user.searches = (user.searches ?? []).slice(0, 400);
    await writeStore(store);
  });
}

export async function markDownloaded(userId: string, resolutionId: string, now = new Date()): Promise<void> {
  const resolution = resolutionId.trim().slice(0, 120);
  if (!resolution) return;
  await withLock(dataDir(), async () => {
    const store = await readStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) return;
    ensureAccount(user);
    const month = limaMonth(now);
    const row = (user.readings ?? []).find((item) => item.resolutionId === resolution && monthOfIso(item.at) === month);
    if (row) row.downloaded = true;
    else if (user.openedIds.includes(resolution) && user.usageMonth === month) {
      user.readings?.unshift({ at: now.toISOString(), resolutionId: resolution, criterion: "", downloaded: true });
    }
    await writeStore(store);
  });
}
