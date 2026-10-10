import { limaMonth } from "./plans";

export const DOC_TYPES = ["DNI", "CE", "Pasaporte"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const PROFESSIONS = [
  ["abogado", "Abogada / Abogado"],
  ["contador", "Contadora / Contador"],
  ["estudiante", "Estudiante"],
  ["otra", "Otra"],
] as const;

export type PayBrand = "visa" | "mastercard";

export type Profile = {
  givenNames: string;
  surnames: string;
  docType: DocType;
  docNumber: string;
  phone: string;
  phoneConfirmed: boolean;
  studentEmail: string;
  profession: string;
  licenseNumber: string;
  firm: string;
  jobTitle: string;
  specialty: string;
  receipt: "boleta" | "factura";
  ruc: string;
  legalName: string;
  fiscalAddress: string;
  twitter: string;
  facebook: string;
  website: string;
  shareCv: boolean;
  photoFile: string | null;
  cvFile: string | null;
  cvName: string;
  cvBytes: number;
  cvUploadedAt: string | null;
};

export type PublicProfile = Omit<Profile, "photoFile" | "cvFile"> & {
  hasPhoto: boolean;
  hasCv: boolean;
};

export type PayCard = {
  id: string;
  brand: PayBrand;
  last4: string;
  expiry: string;
  principal: boolean;
};

export type Movement = {
  id: string;
  at: string;
  concept: string;
  brand: PayBrand | "";
  last4: string;
  receipt: string;
  amountSoles: number;
  status: "pagado" | "rechazado";
};

export type ReadingLog = {
  at: string;
  resolutionId: string;
  criterion: string;
  downloaded: boolean;
};

export type SearchLog = {
  at: string;
  query: string;
};

export type LinkedInLink = {
  name: string;
  email: string;
};

export function emptyProfile(): Profile {
  return {
    givenNames: "",
    surnames: "",
    docType: "DNI",
    docNumber: "",
    phone: "",
    phoneConfirmed: false,
    studentEmail: "",
    profession: "",
    licenseNumber: "",
    firm: "",
    jobTitle: "",
    specialty: "",
    receipt: "boleta",
    ruc: "",
    legalName: "",
    fiscalAddress: "",
    twitter: "",
    facebook: "",
    website: "",
    shareCv: false,
    photoFile: null,
    cvFile: null,
    cvName: "",
    cvBytes: 0,
    cvUploadedAt: null,
  };
}

function clip(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function normalizeProfile(value: unknown): Profile {
  const blank = emptyProfile();
  if (!value || typeof value !== "object") return blank;
  const raw = value as Partial<Profile>;
  const docType = DOC_TYPES.includes(raw.docType as DocType) ? (raw.docType as DocType) : "DNI";
  const profession = PROFESSIONS.some(([id]) => id === raw.profession) ? String(raw.profession) : "";
  return {
    givenNames: clip(raw.givenNames, 60),
    surnames: clip(raw.surnames, 60),
    docType,
    docNumber: clip(raw.docNumber, 15).replace(/[^\dA-Za-z]/g, ""),
    phone: clip(raw.phone, 20),
    phoneConfirmed: raw.phoneConfirmed === true,
    studentEmail: clip(raw.studentEmail, 120).toLowerCase(),
    profession,
    licenseNumber: clip(raw.licenseNumber, 40),
    firm: clip(raw.firm, 80),
    jobTitle: clip(raw.jobTitle, 80),
    specialty: clip(raw.specialty, 160),
    receipt: raw.receipt === "factura" ? "factura" : "boleta",
    ruc: clip(raw.ruc, 11).replace(/\D/g, ""),
    legalName: clip(raw.legalName, 120),
    fiscalAddress: clip(raw.fiscalAddress, 160),
    twitter: clip(String(raw.twitter ?? "").replace(/^@/, ""), 30),
    facebook: clip(raw.facebook, 80),
    website: clip(raw.website, 80),
    shareCv: raw.shareCv === true,
    photoFile: raw.photoFile === "foto.jpg" || raw.photoFile === "foto.png" ? raw.photoFile : null,
    cvFile: raw.cvFile === "cv.bin" ? "cv.bin" : null,
    cvName: clip(raw.cvName, 80),
    cvBytes: Number.isFinite(raw.cvBytes) ? Math.max(0, Number(raw.cvBytes)) : 0,
    cvUploadedAt: typeof raw.cvUploadedAt === "string" ? raw.cvUploadedAt : null,
  };
}

export function toPublicProfile(profile: Profile): PublicProfile {
  return {
    givenNames: profile.givenNames,
    surnames: profile.surnames,
    docType: profile.docType,
    docNumber: profile.docNumber,
    phone: profile.phone,
    phoneConfirmed: profile.phoneConfirmed,
    studentEmail: profile.studentEmail,
    profession: profile.profession,
    licenseNumber: profile.licenseNumber,
    firm: profile.firm,
    jobTitle: profile.jobTitle,
    specialty: profile.specialty,
    receipt: profile.receipt,
    ruc: profile.ruc,
    legalName: profile.legalName,
    fiscalAddress: profile.fiscalAddress,
    twitter: profile.twitter,
    facebook: profile.facebook,
    website: profile.website,
    shareCv: profile.shareCv,
    cvName: profile.cvName,
    cvBytes: profile.cvBytes,
    cvUploadedAt: profile.cvUploadedAt,
    hasPhoto: Boolean(profile.photoFile),
    hasCv: Boolean(profile.cvFile),
  };
}

export function professionLabel(id: string): string {
  return PROFESSIONS.find(([key]) => key === id)?.[1] ?? "";
}

export function displayName(name: string, profile: Pick<Profile, "givenNames" | "surnames">): string {
  const full = `${profile.givenNames} ${profile.surnames}`.replace(/\s+/g, " ").trim();
  return full || name;
}

export function initials(label: string): string {
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function splitPersonName(full: string): { givenNames: string; surnames: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { givenNames: parts[0] ?? "", surnames: "" };
  if (parts.length === 2) return { givenNames: parts[0], surnames: parts[1] };
  if (parts.length === 3) return { givenNames: parts[0], surnames: parts.slice(1).join(" ") };
  return { givenNames: parts.slice(0, -2).join(" "), surnames: parts.slice(-2).join(" ") };
}

export function profileCompleteness(
  profile: PublicProfile,
): { percent: number; missing: string | null } {
  const items: Array<[boolean, string]> = [
    [Boolean(profile.givenNames && profile.surnames), "completar tu nombre."],
    [Boolean(profile.docNumber), "agregar tu documento."],
    [Boolean(profile.phone && profile.phoneConfirmed), profile.phone ? "confirmar tu celular." : "agregar tu celular."],
    [Boolean(profile.profession), "indicar tu profesión."],
    [Boolean(profile.firm), "indicar tu estudio o empresa."],
    [profile.hasPhoto, "subir tu foto."],
    [profile.hasCv, "subir tu CV."],
  ];
  const done = items.filter(([ok]) => ok).length;
  const gap = items.find(([ok]) => !ok);
  return {
    percent: Math.floor((done / items.length) * 100),
    missing: gap ? gap[1] : null,
  };
}

export function parseCardInput(
  brandRaw: string,
  last4Raw: string,
  expiryRaw: string,
): { ok: true; value: { brand: PayBrand; last4: string; expiry: string } } | { ok: false; message: string } {
  const brand = brandRaw === "mastercard" ? "mastercard" : brandRaw === "visa" ? "visa" : "";
  if (!brand) return { ok: false, message: "Elige Visa o Mastercard." };
  const last4 = last4Raw.replace(/\D/g, "");
  if (!/^\d{4}$/.test(last4)) return { ok: false, message: "Escribe solo los últimos 4 dígitos." };
  const expiry = expiryRaw.trim().replace(/[.\-\s]/g, "/").replace(/\/+/g, "/");
  const match = /^(\d{1,2})\/(\d{2}|\d{4})$/.exec(expiry);
  const month = match ? Number(match[1]) : 0;
  if (!match || month < 1 || month > 12) return { ok: false, message: "El vencimiento va como 08/29." };
  const year = match[2].slice(-2);
  return { ok: true, value: { brand, last4, expiry: `${String(month).padStart(2, "0")}/${year}` } };
}

export function brandLabel(brand: string): string {
  if (brand === "visa") return "Visa";
  if (brand === "mastercard") return "Mastercard";
  return "";
}

function parts(iso: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return [];
  return new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", ...options }).formatToParts(date);
}

function part(list: Intl.DateTimeFormatPart[], type: string): string {
  return list.find((item) => item.type === type)?.value ?? "";
}

export function limaDay(iso: string): string {
  const list = parts(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
  if (list.length === 0) return "—";
  return `${part(list, "day")}/${part(list, "month")}/${part(list, "year")}`;
}

/** «10/10, 09:14» en hora de Lima. */
export function limaStamp(iso: string): string {
  const list = parts(iso, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (list.length === 0) return "—";
  return `${part(list, "day")}/${part(list, "month")}, ${part(list, "hour")}:${part(list, "minute")}`;
}

export function monthTitle(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return ym;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  const name = new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: "UTC" }).format(date);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${match[1]}`;
}

/** Último día del mes de Lima, «31/10/2026». */
export function chargeDateLabel(now = new Date()): string {
  const [year, month] = limaMonth(now).split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  const day = String(last.getUTCDate()).padStart(2, "0");
  const mm = String(last.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${mm}/${last.getUTCFullYear()}`;
}

export function monthOfIso(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return limaMonth(date);
}

export function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
