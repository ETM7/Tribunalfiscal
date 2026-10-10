"use server";

import { redirect } from "next/navigation";
import { changePassword, loginUser, registerUser, requestPlan } from "@/lib/accounts";
import { planRequestNotice, PLANS } from "@/lib/plans";
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
  redirect("/portal");
}

export async function requestPlanAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) portalNotice("Entra con tu cuenta para solicitar un plan.");
  const planId = String(formData.get("plan") ?? "");
  const result = await requestPlan(user.id, planId);
  if (!result.ok) portalNotice(result.message);
  portalNotice(planRequestNotice(PLANS[result.value]));
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
