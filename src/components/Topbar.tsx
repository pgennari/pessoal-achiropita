"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sessao, auth } from "@/lib/auth";
import { db } from "@/lib/db";

export function Topbar({ sessao }: { sessao: Sessao }) {
  const router = useRouter();
  const edicaoAtiva = db.edicaoAtiva();

  function sair() {
    auth.sair();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <Link href="/" className="md:hidden text-achiropita-700 font-semibold">
          Achiropita 100
        </Link>
        {edicaoAtiva && (
          <div className="hidden md:block text-sm text-slate-600">
            Edição corrente:{" "}
            <span className="font-semibold text-slate-800">
              {edicaoAtiva.numero}ª · {edicaoAtiva.ano}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-slate-800">{sessao.nome}</div>
          <div className="text-xs text-slate-500">
            {sessao.email} · {sessao.perfil}
          </div>
        </div>
        <div className="h-9 w-9 rounded-full bg-achiropita-100 text-achiropita-700 flex items-center justify-center text-sm font-semibold">
          {sessao.nome.charAt(0).toUpperCase()}
        </div>
        <button onClick={sair} className="btn-secondary text-xs">
          Sair
        </button>
      </div>
    </header>
  );
}
