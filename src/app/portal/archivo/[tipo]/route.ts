import { readProfileFile } from "@/lib/accounts";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

type Context = { params: Promise<{ tipo: string }> };

export async function GET(_request: Request, context: Context) {
  const { tipo } = await context.params;
  if (tipo !== "foto" && tipo !== "cv") return new Response("No encontrado", { status: 404 });
  const user = await currentUser();
  if (!user) return new Response("Entra con tu cuenta.", { status: 401 });
  try {
    const file = await readProfileFile(user.id, tipo);
    if (!file) return new Response("No encontrado", { status: 404 });
    const headers = new Headers({
      "content-type": file.type,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
    if (tipo === "cv") headers.set("content-disposition", `inline; filename="${file.filename.replace(/"/g, "")}"`);
    return new Response(Buffer.from(file.bytes), { headers });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
