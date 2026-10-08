import { parseTranscriptRequest, prepareTranscript } from "@/lib/transcript";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return text("La solicitud no se pudo leer.", 400);
  }
  if (!payload || typeof payload !== "object") return text("La solicitud no se pudo leer.", 400);
  const body = payload as Record<string, unknown>;
  const parsed = parseTranscriptRequest({
    id: stringField(body.id),
    pdfPath: stringField(body.pdfPath),
    exacta: stringField(body.exacta),
    todas: stringField(body.todas),
    cerca: stringField(body.cerca),
    sumillaUrl: stringField(body.sumillaUrl),
  });
  if (!parsed.ok) return text(parsed.message, 400);

  try {
    const ready = await prepareTranscript(parsed.request);
    return Response.json({
      filename: ready.filename,
      summary: ready.summary,
      document: ready.document,
      html: ready.html,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude leer las páginas del PDF. Ábrelo en el MEF.";
    const status = /espera a que termine/i.test(message) ? 429 : message.startsWith("El PDF") || message.startsWith("La ") ? 400 : 502;
    return text(message, status);
  }
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
