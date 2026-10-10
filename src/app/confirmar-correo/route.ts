import { redirect } from "next/navigation";
import { confirmEmailByToken } from "@/lib/accounts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await confirmEmailByToken(token);
  const message = result.ok ? "Correo confirmado." : result.message;
  redirect(`/portal?seccion=datos&aviso=${encodeURIComponent(message)}`);
}
