import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Achiropita 100 — Gestão da equipe",
  description:
    "Aplicativo de gestão da equipe da Festa de Nossa Senhora Achiropita do Bixiga.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
