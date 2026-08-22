import { NavLink, useLocation } from "react-router-dom";
import { Sessao, pode } from "../lib/sessao";
import { useEdicaoAtiva } from "../lib/hooks";
import { useFavoritos, ROTAS } from "../lib/favoritos";
import { Icone } from "./Icone";
import { useState, useEffect } from "react";

interface ItemNav {
  to: string;
  label: string;
  icone?: string;
  permissoes?: string[];
  filhos?: ItemNav[];
  excluirAtivo?: string[];
}

interface Secao {
  label?: string;
  to?: string;
  icone?: string;
  permissoes?: string[];
  itens: ItemNav[];
}

const secoes: Secao[] = [
  {
    label: "Pessoas",
    to: "/pessoas",
    icone: "usuarios",
    permissoes: [
      "pessoas.lista",
      "pessoas.equipe",
      "pessoas.proprio",
      "veiculos.lista",
      "veiculos.equipe",
      "veiculos.proprio",
    ],
    itens: [
      {
        to: "/criancas",
        label: "Crianças",
        icone: "usuario",
        permissoes: ["pessoas.lista"],
      },
      {
        to: "/veiculos",
        label: "Veículos",
        icone: "carro",
        permissoes: ["veiculos.lista", "veiculos.equipe", "veiculos.proprio"],
      },
    ],
  },
  {
    label: "Edição da Festa",
    to: "/edicoes",
    icone: "calendario",
    permissoes: [
      "edicao.lista",
      "edicao.detalhe",
      "presenca.lista",
      "presenca.linkGerar",
      "presenca.linkRevogar",
      "formacao.turmas",
      "formacao.marcarManual",
    ],
    itens: [
      {
        to: "/edicoes/ativa",
        label: "Equipes",
        icone: "usuarios",
        permissoes: ["edicao.lista", "edicao.detalhe"],
      },
      {
        to: "/presenca",
        label: "Presença",
        icone: "presenca",
        permissoes: [
          "presenca.lista",
          "presenca.linkGerar",
          "presenca.linkRevogar",
        ],
        excluirAtivo: ["/presenca/relatorio"],
      },
      {
        to: "/formacao",
        label: "Formação",
        icone: "clipboard",
        permissoes: ["formacao.turmas", "formacao.marcarManual"],
      },
      {
        to: "/avaliacao",
        label: "Avaliação",
        icone: "avaliar",
        permissoes: ["avaliacao.gerenciar"],
      },
    ],
  },
  {
    label: "Estacionamentos",
    to: "/estacionamentos",
    icone: "MapPin",
    permissoes: ["vaga.lista", "vaga.detalhe"],
    itens: [
      {
        to: "/vagas",
        label: "Vagas",
        icone: "alvo",
        permissoes: ["vaga.lista", "vaga.detalhe"],
      },
      {
        to: "/dashboard/estacionamentos",
        label: "Check-ins do dia",
        icone: "checkin",
        permissoes: ["estacionamento.dashboard"],
      },
    ],
  },
  {
    label: "Relatórios",
    itens: [
      {
        to: "/presenca/relatorio",
        label: "Presença",
        icone: "check",
        permissoes: ["presenca.relatorio"],
      },
      {
        to: "/estacionamentos/relatorio",
        label: "Estacionamento",
        icone: "relatorioestacionamento",
        permissoes: ["estacionamento.relatorio", "estacionamento.dashboard"],
      },
    ],
  },
  {
    label: "Configurações",
    itens: [
      { to: "/usuarios", label: "Usuários", icone: "usuarios", permissoes: ["usuario.lista"] },
      {
        to: "/perfis",
        label: "Perfis",
        icone: "usuario",
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
        icone: "cadeado",
        permissoes: ["permissao.gerenciar"],
      },
      {
        to: "/parametros",
        label: "Parâmetros",
        icone: "chaves",
        permissoes: ["parametros.acessar"],
      },
      { to: "/auditoria", label: "Auditoria", icone: "historico", permissoes: ["auditoria.ver"] },
      {
        to: "/setores",
        label: "Setores",
        icone: "grade",
        permissoes: ["setor.lista", "setor.editar"],
      },
      {
        to: "/sincronizacao",
        label: "Sincronização",
        icone: "recarregar",
        permissoes: ["sincronizacao.executar"],
      },
    ],
  },
];

const LARGURA_OPEN = "w-64";
const LARGURA_CLOSED = "w-16";
const CHAVE_COLAPSADO = "sidebar-colapsado";

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
  const { favoritos } = useFavoritos();
  const location = useLocation();

  const [colapsado, setColapsado] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_COLAPSADO) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_COLAPSADO, colapsado ? "1" : "0");
    } catch {
      // ignored
    }
  }, [colapsado]);

  const largura = colapsado ? LARGURA_CLOSED : LARGURA_OPEN;

  const classeLink = (isActive: boolean) =>
    [
      "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-sans transition",
      colapsado && "justify-center px-0",
      isActive
        ? "bg-pietra text-verde-escuro font-semibold"
        : "text-carbone hover:bg-pietra",
    ].join(" ");

  const classeLinkSecao = (isActive: boolean) =>
    [
      "flex items-center gap-2 px-3 py-2 text-sm font-sans font-semibold uppercase tracking-wider transition rounded-sm",
      colapsado && "justify-center px-0",
      isActive
        ? "bg-pietra text-verde"
        : "text-verde hover:text-verde-escuro hover:bg-pietra",
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
          "fixed md:sticky top-0 inset-y-0 left-0 z-40 shrink-0 md:h-screen",
          "flex-col border-r border-pietra bg-bianco transition-[width] duration-200",
          largura,
          aberta ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        {/* Header */}
        <div className="px-4 py-5 border-b border-pietra-clara flex items-center gap-2">
          {!colapsado && (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src="/logo-achiropita.png"
                alt="Nossa Senhora Achiropita"
                className="h-10 w-auto shrink-0"
              />
              <div className="min-w-0">
                <div className="eyebrow text-[9px]">Festa Nsa. Sra.</div>
                <div className="font-display text-lg leading-tight">
                  <span className="text-verde">Achiropita</span>
                </div>
              </div>
            </div>
          )}
          {colapsado && (
            <img
              src="/logo-achiropita.png"
              alt="Achiropita"
              className="h-8 w-auto shrink-0 mx-auto"
            />
          )}
          <button
            type="button"
            className="md:hidden text-ardesia text-2xl leading-none px-1 py-0.5 hover:text-carbone ml-auto"
            onClick={onFechar}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto space-y-3">
          {/* Atalho para edição ativa */}
          {edicaoAtiva && (
            <div>
              {!colapsado && (
                <div className="px-3 pt-1 pb-1 text-[10px] font-sans uppercase tracking-wider text-verde/60">
                  Edição Ativa
                </div>
              )}
              <div className="space-y-0.5">
                <NavLink
                  to={`/edicoes/${edicaoAtiva.id}`}
                  end={false}
                  onClick={onFechar}
                  title={colapsado ? `${edicaoAtiva.numero}ª edição · ${edicaoAtiva.ano}` : undefined}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-semibold transition",
                      colapsado && "justify-center px-0",
                      isActive
                        ? "bg-verde/10 text-verde-escuro border-l-2 border-verde"
                        : "text-carbone hover:bg-verde/5 border-l-2 border-transparent",
                    ].join(" ")
                  }
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-verde shrink-0" />
                  {!colapsado && (
                    <span className="truncate">
                      {edicaoAtiva.numero}ª edição · {edicaoAtiva.ano}
                    </span>
                  )}
                </NavLink>
              </div>
            </div>
          )}

          {/* Favoritos */}
          {favoritos.length > 0 && (
            <div>
              {!colapsado && (
                <div className="px-3 pt-1 pb-1 text-[10px] font-sans uppercase tracking-wider text-verde/60">
                  Favoritos
                </div>
              )}
              <div className="space-y-0.5">
                {favoritos.map((rota) => {
                  const meta = ROTAS[rota];
                  if (!meta) return null;
                  return (
                    <NavLink
                      key={rota}
                      to={rota}
                      onClick={onFechar}
                      title={colapsado ? meta.label : undefined}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-semibold transition",
                          colapsado && "justify-center px-0",
                          isActive
                            ? "bg-verde/10 text-verde-escuro border-l-2 border-verde"
                            : "text-carbone hover:bg-verde/5 border-l-2 border-transparent",
                        ].join(" ")
                      }
                    >
                      <Icone nome={meta.icone} tamanho={18} className="shrink-0" />
                      {!colapsado && <span>{meta.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seções */}
          {secoes.map((secao, si) => {
            if (secao.permissoes && !itemVisivel(secao, sessao)) return null;
            const itensVisiveis = secao.itens.filter((item) =>
              itemVisivel(item, sessao),
            );
            if (itensVisiveis.length === 0) return null;

            return (
              <div key={si}>
                {secao.label && secao.to ? (
                  <NavLink
                    to={secao.to}
                    end
                    onClick={onFechar}
                    title={colapsado ? secao.label : undefined}
                    className={({ isActive }) => classeLinkSecao(isActive)}
                  >
                    {secao.icone && (
                      <Icone nome={secao.icone} tamanho={16} className="shrink-0" />
                    )}
                    {!colapsado && <span>{secao.label}</span>}
                  </NavLink>
                ) : secao.label ? (
                  <div
                    className={`px-3 py-2 text-[11px] font-sans font-semibold uppercase tracking-wider text-ardesia flex items-center gap-2${colapsado ? " justify-center px-0" : ""}`}
                    title={colapsado ? secao.label : undefined}
                  >
                    {secao.icone && (
                      <Icone nome={secao.icone} tamanho={16} className="shrink-0" />
                    )}
                    {!colapsado && <span>{secao.label}</span>}
                  </div>
                ) : null}
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
                          title={colapsado ? item.label : undefined}
                          className={() =>
                            classeLink(itemAtivo(item, location.pathname))
                          }
                        >
                          {item.icone && (
                            <Icone nome={item.icone} tamanho={14} className="shrink-0" />
                          )}
                          {!colapsado && <span>{item.label}</span>}
                        </NavLink>
                        {filhosVisiveis && filhosVisiveis.length > 0 && !colapsado && (
                          <div className="ml-3 pl-3 border-l border-pietra space-y-0.5 mt-0.5 mb-1">
                            {filhosVisiveis.map((filho) => (
                              <NavLink
                                key={filho.to}
                                to={filho.to}
                                onClick={onFechar}
                                className={({ isActive }) =>
                                  classeLink(isActive)
                                }
                              >
                                {filho.icone && (
                                  <Icone nome={filho.icone} tamanho={14} className="shrink-0" />
                                )}
                                <span>{filho.label}</span>
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

        {/* Footer */}
        {!colapsado && (
          <div
            className="p-4 pr-8 border-t border-pietra-clara text-xs text-ardesia font-mono"
            title="Versão do build"
          >
            {VERSAO_APP}
          </div>
        )}

        {/* Botao flutuante de recolher/expandir, sobre a borda com o conteudo */}
        <button
          type="button"
          className="hidden md:flex absolute bottom-5 -right-3 z-10 h-7 w-7 items-center justify-center rounded-full border border-pietra-clara bg-bianco text-ardesia shadow-sm hover:bg-pietra hover:text-carbone transition"
          onClick={() => setColapsado((c) => !c)}
          aria-label={colapsado ? "Expandir menu" : "Recolher menu"}
          title={colapsado ? "Expandir menu" : "Recolher menu"}
        >
          <Icone nome={colapsado ? "expandir" : "recolher"} tamanho={14} />
        </button>
      </aside>
    </>
  );
}
