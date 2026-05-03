"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sessao, auth } from "@/lib/auth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const s = auth.sessao();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSessao(s);
    setCarregando(false);

    const handler = () => setSessao(auth.sessao());
    window.addEventListener("achiropita:sessao", handler);
    return () => window.removeEventListener("achiropita:sessao", handler);
  }, [router]);

  if (carregando || !sessao) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar sessao={sessao} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar sessao={sessao} />
        <main className="flex-1 px-4 md:px-8 py-6 max-w-7xl w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
