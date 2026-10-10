"use server";

import { redirect } from "next/navigation";
import { changePassword, loginUser, registerUser, requestPlan } from "@/lib/accounts";
import { isBillingCycle, isEduPeEmail, planRequestNotice, PLANS } from "@/lib/plans";
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
  const result = await registerUser({
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("nombre") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) portalNotice(result.message);
  await startSession(result.value.id);
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

export async function validateEduAction(): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/portal");
  if (!isEduPeEmail(user.email)) {
    redirect(
      `/precios?aviso=${encodeURIComponent("Ese beneficio es para un correo que termina en edu.pe.")}`,
    );
  }
  if (user.plan !== "junior") {
    redirect(
      `/precios?aviso=${encodeURIComponent("Tu plan ya incluye las lecturas de Senior o más.")}`,
    );
  }
  const result = await requestPlan(user.id, "senior", "mensual");
  if (!result.ok) redirect(`/precios?aviso=${encodeURIComponent(result.message)}`);
  redirect(
    `/precios?aviso=${encodeURIComponent("Tu correo edu.pe quedó anotado. El administrador activa Senior gratis mientras estudies.")}`,
  );
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
