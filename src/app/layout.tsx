import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { ensureAdmin } from "@/lib/accounts";
import { currentUser } from "@/lib/session";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jurisprudencia del Tribunal Fiscal",
  description:
    "Búsqueda puntual en el formulario público del Tribunal Fiscal del Perú. Muestra la sumilla de la página que pides.",
};

export const runtime = "nodejs";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await ensureAdmin();
  const user = await currentUser();
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="min-h-full antialiased">
        <SiteHeader user={user} />
        {children}
      </body>
    </html>
  );
}
