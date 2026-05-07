import { NavLink } from "react-router-dom";
import { Sessao } from "../lib/sessao";
import { Perfil } from "../lib/tipos";

interface ItemNav {
  to: string;
  label: string;
  perfis?: Perfil[];
}

const itens: ItemNav[] = [
  { to: "/", label: "Painel" },
  { to: "/pessoas", label: "Pessoas" },
  { to: "/edicoes", label: "Edições" },
  { to: "/auditoria", label: "Auditoria", perfis: ["ADM", "ORG"] },
];

export function Sidebar({ sessao }: { sessao: Sessao }) {
  const visiveis = itens.filter(
    (i) => !i.perfis || i.perfis.includes(sessao.perfil)
  );

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-pietra bg-bianco">
      <div className="px-6 py-7 border-b border-pietra-clara">
        <div className="eyebrow">Festa 100ª</div>
        <div className="font-display text-2xl mt-1">
          <span className="text-verde">Achiropita</span>{" "}
          <span className="text-vermelho italic font-light">Bixiga</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {visiveis.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              [
                "flex items-center px-3 py-2.5 rounded-sm text-sm font-semibold transition",
                isActive
                  ? "bg-pietra-clara text-verde-escuro"
                  : "text-carbone hover:bg-pietra-clara",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-pietra-clara text-xs text-ardesia font-mono">
        v0.1
      </div>
    </aside>
  );
}
