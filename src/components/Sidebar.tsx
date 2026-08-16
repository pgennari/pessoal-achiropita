import { NavLink, useLocation } from "react-router-dom";
import { Sessao, pode } from "../lib/sessao";
import { useEdicaoAtiva } from "../lib/hooks";

// A navegacao e controlada pelas permissoes do catalogo de perfis
// (sessao.permissoes). Um item aparece se o perfil tem QUALQUER uma das
// permissoes listadas; item sem `permissoes` fica visivel para todos.
interface ItemNav {
  to: string;
  label: string;
  permissoes?: string[];
  filhos?: ItemNav[];
  excluirAtivo?: string[];
}

interface Secao {
  label?: string;
  permissoes?: string[];
  itens: ItemNav[];
}

const secoes: Secao[] = [
  {
    label: "Gestão de Estacionamento",
    permissoes: [
      "veiculos.lista",
      "veiculos.equipe",
      "veiculos.proprio",
      "estacionamento.lista",
      "estacionamento.detalhe",
      "estacionamento.relatorio",
      "estacionamento.dashboard",
      "vaga.lista",
      "vaga.detalhe",
    ],
    itens: [
      {
        to: "/veiculos",
        label: "Veículos",
        permissoes: ["veiculos.lista", "veiculos.equipe", "veiculos.proprio"],
      },
      {
        to: "/vagas",
        label: "Vagas",
        permissoes: ["vaga.lista", "vaga.detalhe"],
      },
      {
        to: "/estacionamentos",
        label: "Estacionamentos",
        permissoes: ["estacionamento.lista", "estacionamento.detalhe"],
        excluirAtivo: ["/estacionamentos/relatorio"],
      },
      {
        to: "/estacionamentos/relatorio",
        label: "Relatório",
        permissoes: ["estacionamento.relatorio", "estacionamento.dashboard"],
      },
    ],
  },
  {
    label: "Pessoal",
    itens: [
      {
        to: "/pessoas",
        label: "Pessoas",
        permissoes: ["pessoas.lista", "pessoas.equipe", "pessoas.proprio"],
      },
      {
        to: "/formacao",
        label: "Formação",
        permissoes: [
          "formacao.marcarManual",
          "formacao.pendenciaListar",
          "formacao.pendenciaEquipe",
          "formacao.turmas",
        ],
        excluirAtivo: ["/formacao/pendencias"],
      },
      {
        to: "/formacao/pendencias",
        label: "Pendências de formação",
        permissoes: ["formacao.pendenciaListar", "formacao.pendenciaEquipe"],
      },
      {
        to: "/presenca",
        label: "Presença",
        permissoes: [
          "presenca.lista",
          "presenca.linkGerar",
          "presenca.linkRevogar",
          "presenca.relatorio",
        ],
        excluirAtivo: ["/presenca/relatorio"],
      },
      {
        to: "/presenca/relatorio",
        label: "Relatório",
        permissoes: ["presenca.relatorio"],
      },
    ],
  },
  {
    label: "Festa",
    permissoes: [
      "edicao.lista",
      "edicao.detalhe",
      "edicao.historico",
      "setor.lista",
      "setor.editar",
    ],
    itens: [
      {
        to: "/edicoes",
        label: "Edição",
        permissoes: ["edicao.lista", "edicao.detalhe"],
        filhos: [
          {
            to: "/historico",
            label: "Histórico",
            permissoes: ["edicao.historico"],
          },
        ],
      },
      {
        to: "/setores",
        label: "Setores",
        permissoes: ["setor.lista", "setor.editar"],
      },
    ],
  },
  {
    label: "Administração",
    itens: [
      { to: "/usuarios", label: "Usuários", permissoes: ["usuario.lista"] },
      { to: "/auditoria", label: "Auditoria", permissoes: ["auditoria.ver"] },
      {
        to: "/perfis",
        label: "Perfis",
        permissoes: [
          "perfil.lista",
          "perfil.incluir",
          "perfil.editar",
          "perfil.excluir",
        ],
      },
      {
        to: "/permissoes",
        label: "Permissões",
        permissoes: ["permissao.gerenciar"],
      },
      {
        to: "/parametros",
        label: "Parâmetros",
        permissoes: ["parametros.acessar"],
      },
      {
        to: "/controle-menu",
        label: "Controle de Menus",
        permissoes: ["perfil.editar"],
      },
      {
        to: "/zeramento",
        label: "Zeramento",
        permissoes: ["zeramento.executar"],
      },
      {
        to: "/sincronizacao",
        label: "Sincronização",
        permissoes: ["sincronizacao.executar"],
      },
    ],
  },
];

function temPermissao(sessao: Sessao, codigo: string): boolean {
  return pode(sessao, codigo);
}

function itemVisivel(item: { permissoes?: string[] }, sessao: Sessao): boolean {
  if (!item.permissoes) return true;
  return item.permissoes.some((c) => temPermissao(sessao, c));
}

function itemAtivo(item: ItemNav, pathname: string): boolean {
  if (pathname === item.to) return true;
  if (!pathname.startsWith(`${item.to}/`)) return false;
  if (item.excluirAtivo?.some((prefixo) => pathname.startsWith(prefixo)))
    return false;
  return true;
}

interface Props {
  sessao: Sessao;
  aberta: boolean;
  onFechar: () => void;
}

export function Sidebar({ sessao, aberta, onFechar }: Props) {
  const { edicao: edicaoAtiva } = useEdicaoAtiva();
  const location = useLocation();

  const classeLink = (isActive: boolean) =>
    [
      "flex items-center px-3 py-2.5 rounded-sm text-sm font-semibold transition",
      isActive
        ? "bg-pietra-clara text-verde-escuro"
        : "text-carbone hover:bg-pietra-clara",
    ].join(" ");

  const classeSubLink = (isActive: boolean) =>
    [
      "flex items-center px-3 py-2 rounded-sm text-sm transition",
      isActive
        ? "text-verde-escuro font-semibold"
        : "text-ardesia hover:text-carbone hover:bg-pietra-clara",
    ].join(" ");

  return (
    <>
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
          <div className="flex items-center gap-3">
            <img
              src="/logo-achiropita.png"
              alt="Nossa Senhora Achiropita"
              className="h-14 w-auto shrink-0"
            />
            <div>
              <div className="eyebrow">Festa Nsa. Sra.</div>
              <div className="font-display text-2xl mt-1">
                <span className="text-verde">Achiropita</span>
              </div>
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

        <nav className="flex-1 p-3 overflow-y-auto space-y-4">
          {/* Atalho para edição ativa */}
          {edicaoAtiva && (
            <div>
              <div className="px-3 pt-1 pb-1 text-[10px] font-sans uppercase tracking-wider text-verde/60">
                Edição Ativa
              </div>
              <div className="space-y-0.5">
                <NavLink
                  to={`/edicoes/${edicaoAtiva.id}`}
                  end={false}
                  onClick={onFechar}
                  className={({ isActive }) =>
                    [
                      "flex items-center px-3 py-2.5 rounded-sm text-sm font-semibold transition",
                      isActive
                        ? "bg-verde/10 text-verde-escuro border-l-2 border-verde"
                        : "text-carbone hover:bg-verde/5 border-l-2 border-transparent",
                    ].join(" ")
                  }
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-verde mr-2" />
                  {edicaoAtiva.numero}ª edição · {edicaoAtiva.ano}
                </NavLink>
                {itemVisivel(
                  { permissoes: ["estacionamento.dashboard"] },
                  sessao,
                ) && (
                  <NavLink
                    to="/dashboard/estacionamentos"
                    onClick={onFechar}
                    className={({ isActive }) =>
                      [
                        "flex items-center px-3 py-2.5 rounded-sm text-sm font-semibold transition",
                        isActive
                          ? "bg-verde/10 text-verde-escuro border-l-2 border-verde"
                          : "text-carbone hover:bg-verde/5 border-l-2 border-transparent",
                      ].join(" ")
                    }
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-verde mr-2" />
                    Check-ins
                  </NavLink>
                )}
              </div>
            </div>
          )}

          {secoes.map((secao, si) => {
            if (secao.permissoes && !itemVisivel(secao, sessao)) return null;
            const itensVisiveis = secao.itens.filter((item) =>
              itemVisivel(item, sessao),
            );
            if (itensVisiveis.length === 0) return null;

            return (
              <div key={si}>
                {secao.label && (
                  <div className="px-3 pt-1 pb-1 text-[10px] font-sans uppercase tracking-wider text-ardesia/40">
                    {secao.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {itensVisiveis.map((item) => {
                    const filhosVisiveis = item.filhos?.filter((f) =>
                      itemVisivel(f, sessao),
                    );

                    return (
                      <div key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.to === "/"}
                          onClick={onFechar}
                          className={() =>
                            classeLink(itemAtivo(item, location.pathname))
                          }
                        >
                          {item.label}
                        </NavLink>
                        {filhosVisiveis && filhosVisiveis.length > 0 && (
                          <div className="ml-3 pl-3 border-l border-pietra space-y-0.5 mt-0.5 mb-1">
                            {filhosVisiveis.map((filho) => (
                              <NavLink
                                key={filho.to}
                                to={filho.to}
                                onClick={onFechar}
                                className={({ isActive }) =>
                                  classeSubLink(isActive)
                                }
                              >
                                {filho.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div
          className="p-4 border-t border-pietra-clara text-xs text-ardesia font-mono"
          title="Versão do build"
        >
          {VERSAO_APP}
        </div>
      </aside>
    </>
  );
}
