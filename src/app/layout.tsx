import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
