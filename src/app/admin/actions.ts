"use server";

import { redirect } from "next/navigation";
import { assignPlan, confirmPendingPlan, createUser, resetUsage } from "@/lib/accounts";
import { PLANS, isPlanId } from "@/lib/plans";
import { currentUser } from "@/lib/session";

function adminNotice(message: string): never {
  redirect(`/admin?aviso=${encodeURIComponent(message)}`);
}

async function requireAdmin(): Promise<void> {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    redirect("/portal?aviso=" + encodeURIComponent("El panel de administrador es solo para cuentas de administración."));
  }
}

export async function assignPlanAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = await assignPlan(String(formData.get("userId") ?? ""), String(formData.get("plan") ?? ""));
  if (!result.ok) adminNotice(result.message);
  adminNotice(`${result.value.name} quedó en el plan ${PLANS[result.value.plan].name}.`);
}

export async function confirmPaymentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = await confirmPendingPlan(String(formData.get("userId") ?? ""));
  if (!result.ok) adminNotice(result.message);
  adminNotice(`Pago confirmado. ${result.value.name} quedó en el plan ${PLANS[result.value.plan].name}.`);
}

export async function resetUsageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const result = await resetUsage(String(formData.get("userId") ?? ""));
  if (!result.ok) adminNotice(result.message);
  adminNotice(`El cupo de ${result.value.name} volvió a cero este mes.`);
}

export async function createUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const plan = String(formData.get("plan") ?? "");
  const result = await createUser({
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("nombre") ?? ""),
    password: String(formData.get("password") ?? ""),
    plan,
    role: String(formData.get("rol") ?? "") === "admin" ? "admin" : "user",
  });
  if (!result.ok) adminNotice(result.message);
  const planName = isPlanId(plan) ? PLANS[plan].name : plan;
  adminNotice(`Cuenta creada para ${result.value.email} en el plan ${planName}.`);
}
