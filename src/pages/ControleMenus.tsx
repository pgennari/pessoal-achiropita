import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, podeGerirPerfis } from "../lib/sessao";
import { usePerfis } from "../lib/hooks";
import { Icone } from "../components/Icone";
import { CATALOGO_MENUS, atualizarPermissoesPerfil } from "../lib/perfis";
import { MenuCatalogo, PerfilInfo } from "../lib/tipos";

// Perfis com acesso administrativo garantido pelo proprio perfil (nao so
// pela permissao): a matriz nao permite restringi-los.
const SIGLAS_ADMIN_FIXO = ["ADM", "ORG"];

interface EstadoColuna {
  permissoes: string[];
  sujo: boolean;
  salvando: boolean;
}

function classeBadgeSigla(sigla: string): string {
  if (sigla === "ADM") return "badge badge-vermelho";
  if (sigla === "ORG") return "badge badge-ouro";
  if (sigla === "CRD") return "badge badge-azul";
  if (sigla === "EQP") return "badge badge-verde";
  return "badge badge-cinza";
}

interface CelulaResolvida {
  marcada: boolean;
  editavel: boolean;
  motivo?: string;
}

function resolverCelula(
  menu: MenuCatalogo,
  perfil: PerfilInfo,
  permissoes: string[]
): CelulaResolvida {
  const menuEAdministracao = menu.permissoes.includes("administracao");
  const temAdministracao = permissoes.includes("administracao");
  const concedidoDireto = menu.permissoes.some((c) =>
    permissoes.includes(c)
  );

  if (perfil.fixo) {
    return {
      marcada: concedidoDireto,
      editavel: false,
      motivo: "Perfil fixo: ADM sempre tem acesso a todos os menus.",
    };
  }
  if (menuEAdministracao) {
    if (SIGLAS_ADMIN_FIXO.includes(perfil.sigla)) {
      return {
        marcada: true,
        editavel: false,
        motivo: "Perfil ORG tem acesso administrativo fixo.",
      };
    }
    return { marcada: temAdministracao, editavel: true };
  }
  if (temAdministracao) {
    return {
      marcada: true,
      editavel: false,
      motivo: "Concedido pela permissão Administração.",
    };
  }
  return { marcada: concedidoDireto, editavel: true };
}

interface PropsCelula {
  menu: MenuCatalogo;
  perfil: PerfilInfo;
  estado: EstadoColuna;
  onAlternar: (menu: MenuCatalogo, perfil: PerfilInfo, ligado: boolean) => void;
}

function CelulaMenu({ menu, perfil, estado, onAlternar }: PropsCelula) {
  const resolvida = resolverCelula(menu, perfil, estado.permissoes);

  if (!resolvida.editavel) {
    return (
      <td className="px-4 py-3 text-center" aria-hidden>
        <span
          title={resolvida.motivo}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-verde/10 text-verde-escuro cursor-help"
        >
          <Icone nome="check" tamanho={16} />
        </span>
      </td>
    );
  }

  return (
    <td className="px-4 py-3 text-center">
      <input
        type="checkbox"
        className="checkbox"
        checked={resolvida.marcada}
        disabled={estado.salvando}
        onChange={(e) => onAlternar(menu, perfil, e.target.checked)}
        title={`${menu.rotulo} — ${perfil.nome}`}
        aria-label={`${menu.rotulo} para ${perfil.nome}`}
      />
    </td>
  );
}

export function ControleMenus() {
  const { sessao } = useSessao();
  const { itens: perfis, carregando } = usePerfis();
  const [porSigla, setPorSigla] = useState<Record<string, EstadoColuna>>({});
  const [erro, setErro] = useState<string | null>(null);

  const secoes = useMemo(() => {
    const ordem: string[] = [];
    for (const menu of CATALOGO_MENUS) {
      if (!ordem.includes(menu.secao)) ordem.push(menu.secao);
    }
    return ordem.map((secao) => ({
      secao,
      menus: CATALOGO_MENUS.filter((m) => m.secao === secao),
    }));
  }, []);

  // Sincroniza o estado de edicao com a lista de perfis do servidor,
  // preservando alteracoes ainda nao salvas de cada coluna.
  useEffect(() => {
    setPorSigla((atual) => {
      const proximo: Record<string, EstadoColuna> = {};
      for (const p of perfis) {
        const anterior = atual[p.sigla];
        proximo[p.sigla] = {
          permissoes: anterior?.sujo ? anterior.permissoes : p.permissoes,
          sujo: anterior?.sujo ?? false,
          salvando: anterior?.salvando ?? false,
        };
      }
      return proximo;
    });
  }, [perfis]);

  if (!sessao) return null;
  if (!podeGerirPerfis(sessao)) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração controla os menus de cada perfil.
          </p>
          <Link
            to="/"
            className="btn btn-secundario mt-4"
            aria-label="Voltar"
            title="Voltar"
          >
            <Icone nome="seta-esquerda" />
          </Link>
        </div>
      </div>
    );
  }

  const s = sessao;

  function estadoDe(perfil: PerfilInfo): EstadoColuna {
    return (
      porSigla[perfil.sigla] ?? {
        permissoes: perfil.permissoes,
        sujo: false,
        salvando: false,
      }
    );
  }

  function alternarMenu(
    menu: MenuCatalogo,
    perfil: PerfilInfo,
    ligado: boolean
  ) {
    setErro(null);
    setPorSigla((atual) => {
      const estado =
        atual[perfil.sigla] ?? {
          permissoes: perfil.permissoes,
          sujo: false,
          salvando: false,
        };
      const base = new Set(estado.permissoes);
      for (const codigo of menu.permissoes) {
        if (ligado) base.add(codigo);
        else base.delete(codigo);
      }
      return {
        ...atual,
        [perfil.sigla]: {
          permissoes: [...base],
          sujo: true,
          salvando: false,
        },
      };
    });
  }

  async function salvarPerfil(perfil: PerfilInfo) {
    const estado = porSigla[perfil.sigla];
    if (!estado || !estado.sujo || estado.salvando) return;
    setErro(null);
    setPorSigla((atual) => ({
      ...atual,
      [perfil.sigla]: { ...estado, salvando: true },
    }));
    try {
      await atualizarPermissoesPerfil(
        s,
        perfil.sigla,
        perfil.nome,
        estado.permissoes
      );
      setPorSigla((atual) => ({
        ...atual,
        [perfil.sigla]: { ...estado, sujo: false, salvando: false },
      }));
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Falha ao salvar as permissões do perfil."
      );
      setPorSigla((atual) => ({
        ...atual,
        [perfil.sigla]: { ...estado, salvando: false },
      }));
    }
  }

  function descartarPerfil(perfil: PerfilInfo) {
    setErro(null);
    setPorSigla((atual) => ({
      ...atual,
      [perfil.sigla]: {
        permissoes: perfil.permissoes,
        sujo: false,
        salvando: false,
      },
    }));
  }

  const totalColunas = perfis.length + 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Administração</div>
          <h2 className="mt-1">Controle de menus</h2>
          <p className="text-ardesia text-sm">
            {carregando
              ? "Carregando..."
              : `${perfis.length} perfil(is) · ${CATALOGO_MENUS.length} menus controláveis`}
          </p>
        </div>
      </header>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia space-y-2">
          <p>
            Marque, para cada perfil, quais menus ele pode acessar. As escolhas
            são gravadas como permissões do perfil e valem também para o
            controle de acesso da API.
          </p>
          <p>
            Perfis <strong>ADM</strong> e <strong>ORG</strong> têm acesso
            administrativo e não podem ser restringidos aqui. Perfis com a
            permissão <em>Administração</em> também enxergam todos os menus —
            para restringir menus específicos, remova essa permissão antes. As
            alterações são aplicadas por perfil, com o botão de salvar na
            coluna.
          </p>
        </div>
      </div>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="tabela-rolavel">
          <table className="tabela-larga">
            <thead className="bg-pietra-clara/60 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold min-w-[280px]">Menu</th>
                {perfis.map((p) => {
                  const estado = estadoDe(p);
                  return (
                    <th
                      key={p.sigla}
                      className="px-4 py-3 font-semibold text-center align-top min-w-[150px]"
                    >
                      <span className={classeBadgeSigla(p.sigla)}>{p.sigla}</span>
                      <div className="text-xs font-normal text-ardesia mt-1">
                        {p.nome}
                      </div>
                      {estado.sujo && !p.fixo && (
                        <div className="flex justify-center gap-1.5 mt-2">
                          <button
                            type="button"
                            className="btn btn-primario btn-pequeno"
                            onClick={() => salvarPerfil(p)}
                            disabled={estado.salvando}
                            aria-label={`Salvar ${p.sigla}`}
                            title="Salvar alterações"
                          >
                            <Icone nome="check" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secundario btn-pequeno"
                            onClick={() => descartarPerfil(p)}
                            disabled={estado.salvando}
                            aria-label={`Descartar alterações de ${p.sigla}`}
                            title="Descartar alterações"
                          >
                            <Icone nome="fechar" />
                          </button>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td
                    colSpan={totalColunas}
                    className="px-4 py-6 text-center text-ardesia"
                  >
                    Carregando...
                  </td>
                </tr>
              )}
              {!carregando && perfis.length === 0 && (
                <tr>
                  <td
                    colSpan={totalColunas}
                    className="px-4 py-8 text-center text-ardesia"
                  >
                    Nenhum perfil cadastrado.
                  </td>
                </tr>
              )}
              {secoes.map((grupo) => (
                <Fragment key={grupo.secao}>
                  <tr className="bg-pietra-clara/60">
                    <td
                      colSpan={totalColunas}
                      className="px-4 py-2 font-semibold text-xs uppercase tracking-wider text-ardesia"
                    >
                      {grupo.secao}
                    </td>
                  </tr>
                  {grupo.menus.map((menu) => (
                    <tr
                      key={menu.id}
                      className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{menu.rotulo}</div>
                        <div className="text-xs text-ardesia mt-0.5">
                          {menu.descricao}
                        </div>
                      </td>
                      {perfis.map((p) => (
                        <CelulaMenu
                          key={p.sigla}
                          menu={menu}
                          perfil={p}
                          estado={estadoDe(p)}
                          onAlternar={alternarMenu}
                        />
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
