"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/auth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sessao, carregando } = useSessao();

  useEffect(() => {
    if (!carregando && !sessao) {
      router.replace("/login");
    }
  }, [carregando, sessao, router]);

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
