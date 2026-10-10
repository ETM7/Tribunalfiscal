import { redirect } from "next/navigation";
import { confirmStudentByToken } from "@/lib/accounts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await confirmStudentByToken(token);
  const message = result.ok
    ? "Correo de estudiante confirmado. Tienes 5 lecturas al mes durante un año."
    : result.message;
  redirect(`/portal?aviso=${encodeURIComponent(message)}`);
}
