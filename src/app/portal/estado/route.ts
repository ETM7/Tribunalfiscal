import { getAccount } from "@/lib/accounts";
import { formatSoles, PLANS } from "@/lib/plans";
import { brandLabel, limaDay } from "@/lib/profile";
import { statementPdf } from "@/lib/statement-pdf";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Entra con tu cuenta.", { status: 401 });
  const account = await getAccount(user.id);
  if (!account) return new Response("No encuentro esa cuenta.", { status: 404 });
  const plan = PLANS[account.plan];
  const lines = [
    "Tribunal Fiscal - Estado de cuenta",
    account.name,
    account.email,
    `Plan: ${plan.name}`,
    "",
    "Fecha        Concepto                         Medio            Monto     Estado",
  ];
  if (account.movements.length === 0) lines.push("Sin movimientos.");
  for (const item of account.movements) {
    const medio = item.last4 ? `${brandLabel(item.brand)} ${item.last4}` : "-";
    lines.push(
      `${limaDay(item.at)}  ${item.concept}  ${medio}  S/ ${formatSoles(item.amountSoles, true)}  ${item.status}`,
    );
  }
  const pdf = statementPdf(lines);
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "attachment; filename=\"estado-de-cuenta.pdf\"",
      "cache-control": "private, no-store",
    },
  });
}
