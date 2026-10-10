"use server";

import { redirect } from "next/navigation";
import {
  addCard,
  beginStudentConfirmation,
  changePassword,
  connectLinkedIn,
  disconnectLinkedIn,
  importLinkedIn,
  logSearch,
  loginUser,
  markDownloaded,
  registerUser,
  removeCard,
  removeCv,
  removePhoto,
  requestPlan,
  saveCv,
  savePhoto,
  saveProfile,
  setAutoRenew,
  useCard,
} from "@/lib/accounts";
import { isBillingCycle, planRequestNotice, PLANS } from "@/lib/plans";
import { clearSession, currentUser, startSession } from "@/lib/session";

function portalNotice(message: string, section = ""): never {
  const params = new URLSearchParams({ aviso: message });
  if (section) params.set("seccion", section);
  redirect(`/portal?${params.toString()}`);
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function loginAction(formData: FormData): Promise<void> {
  const result = await loginUser(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!result.ok) portalNotice(result.message);
  await startSession(result.value.id);
  redirect("/portal");
}

export async function registerAction(formData: FormData): Promise<void> {
  const student = String(formData.get("estudiante") ?? "") === "1";
  const result = await registerUser({
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("nombre") ?? ""),
    password: String(formData.get("password") ?? ""),
    student,
  });
  if (!result.ok) {
    const back = student ? `/portal?alta=estudiante&aviso=${encodeURIComponent(result.message)}#registro` : "";
    if (back) redirect(back);
    portalNotice(result.message);
  }
  await startSession(result.value.id);
  if (student) {
    redirect(
      `/portal?aviso=${encodeURIComponent("Cuenta creada. Abre el enlace de esta página para confirmar el correo de estudiante.")}`,
    );
  }
  redirect("/portal");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}

export async function requestPlanAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta para solicitar un plan.");
  const planId = String(formData.get("plan") ?? "");
  const cycleRaw = String(formData.get("ciclo") ?? "mensual");
  const cycle = isBillingCycle(cycleRaw) ? cycleRaw : "mensual";
  const result = await requestPlan(user.id, planId, cycle);
  if (!result.ok) portalNotice(result.message);
  const back = String(formData.get("volver") ?? "");
  const notice = planRequestNotice(PLANS[result.value], cycle);
  if (back === "precios") redirect(`/precios?aviso=${encodeURIComponent(notice)}`);
  portalNotice(notice);
}

export async function beginStudentAction(): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/portal?alta=estudiante#registro");
  const result = await beginStudentConfirmation(user.id);
  if (!result.ok) portalNotice(result.message);
  portalNotice("Abre el enlace de esta página para confirmar el correo de estudiante.");
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta para cambiar la contraseña.");
  const result = await changePassword(
    user.id,
    String(formData.get("actual") ?? ""),
    String(formData.get("nueva") ?? ""),
  );
  const section = text(formData, "seccion") === "seguridad" ? "seguridad" : "";
  if (!result.ok) portalNotice(result.message, section);
  portalNotice("La contraseña quedó cambiada.", section);
}

export async function saveProfileAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta para guardar tus datos.", "datos");
  const result = await saveProfile(user.id, {
    givenNames: text(formData, "nombres"),
    surnames: text(formData, "apellidos"),
    docType: text(formData, "documento"),
    docNumber: text(formData, "numero"),
    phone: text(formData, "celular"),
    studentEmail: text(formData, "estudiante"),
    profession: text(formData, "profesion"),
    licenseNumber: text(formData, "colegiatura"),
    firm: text(formData, "estudio"),
    jobTitle: text(formData, "cargo"),
    specialty: text(formData, "especialidad"),
    receipt: text(formData, "comprobante"),
    ruc: text(formData, "ruc"),
    legalName: text(formData, "razon"),
    fiscalAddress: text(formData, "direccion"),
    twitter: text(formData, "twitter"),
    facebook: text(formData, "facebook"),
    website: text(formData, "web"),
    shareCv: formData.get("compartir") === "1",
    email: text(formData, "email"),
    confirmPhone: text(formData, "confirmar") === "1",
  });
  if (!result.ok) portalNotice(result.message, "datos");
  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    const saved = await savePhoto(user.id, Buffer.from(await foto.arrayBuffer()));
    if (!saved.ok) portalNotice(saved.message, "datos");
  }
  const cv = formData.get("cv");
  if (cv instanceof File && cv.size > 0) {
    const saved = await saveCv(user.id, Buffer.from(await cv.arrayBuffer()), cv.name);
    if (!saved.ok) portalNotice(saved.message, "datos");
  }
  const extra = result.value.emailToken ? " Para el correo nuevo, abre el enlace de esta página." : "";
  portalNotice(`Datos guardados.${extra}`, "datos");
}

export async function removePhotoAction(): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta.", "datos");
  const result = await removePhoto(user.id);
  if (!result.ok) portalNotice(result.message, "datos");
  portalNotice("Foto quitada.", "datos");
}

export async function removeCvAction(): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta.", "datos");
  const result = await removeCv(user.id);
  if (!result.ok) portalNotice(result.message, "datos");
  portalNotice("CV eliminado.", "datos");
}

export async function connectLinkedInAction(): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta para vincular LinkedIn.", "seguridad");
  const result = await connectLinkedIn(user.id);
  if (!result.ok) portalNotice(result.message, "seguridad");
  portalNotice("LinkedIn quedó vinculado a tu nombre y correo. La entrada sigue siendo con contraseña.", "seguridad");
}

export async function disconnectLinkedInAction(): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta.", "datos");
  const result = await disconnectLinkedIn(user.id);
  if (!result.ok) portalNotice(result.message, "datos");
  portalNotice("LinkedIn desconectado.", "datos");
}

export async function importLinkedInAction(): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta.", "datos");
  const result = await importLinkedIn(user.id);
  if (!result.ok) portalNotice(result.message, "datos");
  portalNotice("Importé el nombre. LinkedIn no entregó una foto en esta copia.", "datos");
}

export async function linkedInLoginAction(): Promise<void> {
  portalNotice("LinkedIn se vincula desde Seguridad, ya dentro de tu cuenta. Para entrar usa tu correo y contraseña.");
}

export async function addCardAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta para guardar una tarjeta.", "estado");
  const result = await addCard(user.id, text(formData, "marca"), text(formData, "ultimos"), text(formData, "vence"));
  if (!result.ok) portalNotice(result.message, "estado");
  portalNotice("Tarjeta guardada. Solo quedaron la marca, los últimos 4 y el vencimiento.", "estado");
}

export async function useCardAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta.", "estado");
  const result = await useCard(user.id, text(formData, "tarjeta"));
  if (!result.ok) portalNotice(result.message, "estado");
  portalNotice("Esa tarjeta quedó como principal.", "estado");
}

export async function removeCardAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta.", "estado");
  const result = await removeCard(user.id, text(formData, "tarjeta"));
  if (!result.ok) portalNotice(result.message, "estado");
  portalNotice("Tarjeta quitada.", "estado");
}

export async function setAutoRenewAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta.", "estado");
  const result = await setAutoRenew(user.id, text(formData, "activa") === "1");
  if (!result.ok) portalNotice(result.message, "estado");
  portalNotice(text(formData, "activa") === "1" ? "Renovación automática activada." : "Renovación automática desactivada.", "estado");
}

export async function logSearchAction(query: string): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await logSearch(user.id, query);
}

export async function markDownloadedAction(resolutionId: string): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await markDownloaded(user.id, resolutionId);
}
