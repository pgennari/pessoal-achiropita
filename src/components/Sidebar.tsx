"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sessao } from "@/lib/auth";
import { cls } from "@/lib/utils";

interface ItemNav {
  href: string;
  label: string;
  perfis?: Sessao["perfil"][];
}

const itens: ItemNav[] = [
  { href: "/", label: "Painel" },
  { href: "/pessoas", label: "Pessoas" },
  { href: "/edicoes", label: "Edições" },
  { href: "/barracas", label: "Barracas" },
  { href: "/alocacao", label: "Alocação" },
  { href: "/formacao", label: "Formação" },
  { href: "/entregas", label: "Entregas" },
  { href: "/auditoria", label: "Auditoria", perfis: ["ADM"] },
];

export function Sidebar({ sessao }: { sessao: Sessao }) {
  const pathname = usePathname();
  const visiveis = itens.filter(
    (i) => !i.perfis || i.perfis.includes(sessao.perfil)
  );
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-6 border-b border-slate-100">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Festa 100ª
        </div>
        <div className="text-lg font-semibold text-achiropita-700">
          Achiropita · Bixiga
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {visiveis.map((item) => {
          const ativo =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cls(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium",
                ativo
                  ? "bg-achiropita-50 text-achiropita-700"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-100 text-xs text-slate-500">
        v0.2 · Firebase
      </div>
    </aside>
  );
}
