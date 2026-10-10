"use server";

import { redirect } from "next/navigation";
import { beginStudentConfirmation, changePassword, loginUser, registerUser, requestPlan } from "@/lib/accounts";
import { isBillingCycle, planRequestNotice, PLANS } from "@/lib/plans";
import { clearSession, currentUser, startSession } from "@/lib/session";

function portalNotice(message: string): never {
  redirect(`/portal?aviso=${encodeURIComponent(message)}`);
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
  if (!result.ok) portalNotice(result.message);
  portalNotice("La contraseña quedó cambiada.");
}
