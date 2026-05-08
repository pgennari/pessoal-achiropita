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
  { to: "/historico", label: "Histórico", perfis: ["ADM", "ORG"] },
  { to: "/formacao", label: "Formação", perfis: ["ADM", "ORG"] },
  {
    to: "/pendencias/formacao",
    label: "Pendências de formação",
    perfis: ["ADM", "ORG"],
  },
  {
    to: "/entregas/crachas",
    label: "Entrega de crachás",
    perfis: ["ADM", "ORG", "OPC"],
  },
  {
    to: "/pendencias/fotos",
    label: "Pendências de foto",
    perfis: ["ADM", "ORG"],
  },
  { to: "/usuarios", label: "Usuários", perfis: ["ADM"] },
  { to: "/auditoria", label: "Auditoria", perfis: ["ADM", "ORG"] },
];

interface Props {
  sessao: Sessao;
  aberta: boolean;
  onFechar: () => void;
}

export function Sidebar({ sessao, aberta, onFechar }: Props) {
  const visiveis = itens.filter(
    (i) => !i.perfis || i.perfis.includes(sessao.perfil)
  );

  return (
    <>
      {/* Backdrop só no mobile, quando aberta */}
      {aberta && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="md:hidden fixed inset-0 z-30 bg-carbone/40"
          onClick={onFechar}
        />
      )}

      <aside
        className={[
          "fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0",
          "flex-col border-r border-pietra bg-bianco",
          aberta ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        <div className="px-6 py-7 border-b border-pietra-clara flex items-start justify-between gap-2">
          <div>
            <div className="eyebrow">Festa 100ª</div>
            <div className="font-display text-2xl mt-1">
              <span className="text-verde">Achiropita</span>{" "}
              <span className="text-vermelho italic font-light">Bixiga</span>
            </div>
          </div>
          <button
            type="button"
            className="md:hidden text-ardesia text-2xl leading-none px-2 py-1 hover:text-carbone"
            onClick={onFechar}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visiveis.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onFechar}
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
    </>
  );
}
