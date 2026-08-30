// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: avaliacao.gerenciar (mesmos perfis que gerenciam avaliacoes: ADM/ORG),
// garantida pelo pai (RelatorioAvaliacoes) antes de renderizar.
// Relatorio somente leitura das avaliacoes de coordenadores feitas pelo
// equipista (028), com o mesmo padrao de filtro/lista da aba Equipistas:
// filtros por setores/equipes/criterios, resumo e cartoes expandiveis.
// Semantica dos filtros: OR dentro do mesmo campo, AND entre campos.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import {
  useAvaliacoesEquipistaCoordenador,
  useEquipes,
  useSetores,
} from "../lib/hooks";
import { Icone } from "../components/Icone";
import { MenuFiltro } from "../components/MenuFiltro";
import { SETORES } from "../lib/tipos";
import {
  AvaliacaoEquipistaCoordenador,
  CriterioEquipista,
} from "../lib/tipos";

const VALORES_CRITERIO: CriterioEquipista[] = ["Otimo", "Bom", "Regular", "Ruim"];

const ROTULO_VALOR: Record<CriterioEquipista, string> = {
  Otimo: "Ótimo",
  Bom: "Bom",
  Regular: "Regular",
  Ruim: "Ruim",
};

const CRITERIOS_RELATORIO: {
  chave: keyof AvaliacaoEquipistaCoordenador["criterios"];
  rotulo: string;
}[] = [
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "dedicacao", rotulo: "Dedicação" },
  { chave: "companheirismo", rotulo: "Companheirismo" },
  { chave: "espiritualidade", rotulo: "Espiritualidade" },
  { chave: "comprometimento", rotulo: "Comprometimento" },
  { chave: "uniforme", rotulo: "Uniforme" },
];

const CRITERIO_COR: Record<CriterioEquipista, string> = {
  Otimo: "#16a34a",
  Bom: "#2563eb",
  Regular: "#ca8a04",
  Ruim: "#dc2626",
};

type CampoCriterio = (typeof CRITERIOS_RELATORIO)[number]["chave"];

interface FiltrosRelatorio {
  setores: Set<string>;
  equipes: Set<string>;
  criterios: Partial<Record<CampoCriterio, Set<CriterioEquipista>>>;
}

const FILTROS_INICIAIS: FiltrosRelatorio = {
  setores: new Set(),
  equipes: new Set(),
  criterios: {},
};

interface Props {
  edicaoId: string;
  edicaoNumero: number;
  edicaoAno: number;
}

function temAlgumFiltro(filtros: FiltrosRelatorio): boolean {
  if (filtros.setores.size > 0 || filtros.equipes.size > 0) return true;
  return CRITERIOS_RELATORIO.some(
    ({ chave }) => (filtros.criterios[chave]?.size ?? 0) > 0
  );
}

function campoAtivo(filtros: FiltrosRelatorio, chave: CampoCriterio): boolean {
  return (filtros.criterios[chave]?.size ?? 0) > 0;
}

function aplicarFiltros(
  avaliacoes: AvaliacaoEquipistaCoordenador[],
  filtros: FiltrosRelatorio,
  excluir?: CampoCriterio,
  equipesPorId?: Map<string, { setor: string; nome: string }>
): AvaliacaoEquipistaCoordenador[] {
  const campos = CRITERIOS_RELATORIO.filter(
    ({ chave }) => chave !== excluir && campoAtivo(filtros, chave)
  );

  if (
    filtros.setores.size === 0 &&
    filtros.equipes.size === 0 &&
    campos.length === 0
  )
    return avaliacoes;

  return avaliacoes.filter((avaliacao) => {
    const atendeCriterios = campos.every(({ chave }) => {
      const valor = avaliacao.criterios[chave];
      return filtros.criterios[chave]!.has(valor);
    });
    const equipe = equipesPorId?.get(avaliacao.equipeId);
    const atendeSetores =
      filtros.setores.size === 0 ||
      (equipe !== undefined && filtros.setores.has(equipe.setor));
    const atendeEquipes =
      filtros.equipes.size === 0 || filtros.equipes.has(avaliacao.equipeId);
    return atendeCriterios && atendeSetores && atendeEquipes;
  });
}

function corValor(valor: CriterioEquipista): string {
  return CRITERIO_COR[valor];
}

function formatarMomento(iso: string): string {
  const data = new Date(iso);
  if (isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RelatorioAvaliacoesCoordenador({ edicaoId, edicaoNumero, edicaoAno }: Props) {
  const { itens: avaliacoes, carregando, erro } =
    useAvaliacoesEquipistaCoordenador(edicaoId);
  const { itens: equipes } = useEquipes(edicaoId);
  const { itens: setores } = useSetores();
  const [filtros, setFiltros] = useState<FiltrosRelatorio>(FILTROS_INICIAIS);
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null);
  const [resumoAberto, setResumoAberto] = useState(false);

  // Fecha o dropdown aberto ao clicar fora dele ou pressionar Escape.
  useEffect(() => {
    if (!dropdownAberto) return;
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as HTMLElement | null;
      if (alvo?.closest("[data-dropdown]")) return;
      setDropdownAberto(null);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setDropdownAberto(null);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [dropdownAberto]);

  function alternarDropdown(chave: string) {
    setDropdownAberto((atual) => (atual === chave ? null : chave));
  }

  function limparCampo(chave: "setores" | "equipes" | CampoCriterio) {
    if (chave === "setores" || chave === "equipes") {
      setFiltros((atual) => ({ ...atual, [chave]: new Set() }));
      return;
    }
    setFiltros((atual) => {
      const criterios = { ...atual.criterios };
      delete criterios[chave];
      return { ...atual, criterios };
    });
  }

  const opcoesSetor = useMemo(() => {
    if (setores.length > 0) {
      return setores.map((s) => ({ valor: s.id, rotulo: s.nome }));
    }
    return SETORES.map((s) => ({ valor: s.valor, rotulo: s.rotulo }));
  }, [setores]);

  const equipesPorId = useMemo(
    () =>
      new Map(
        equipes.map((e) => [e.id, { setor: e.setor, nome: e.nome }] as const)
      ),
    [equipes]
  );

  const opcoesEquipe = useMemo(
    () =>
      equipes
        .map((e) => ({ valor: e.id, rotulo: e.nome }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    [equipes]
  );

  const filtradas = useMemo(
    () => aplicarFiltros(avaliacoes, filtros, undefined, equipesPorId),
    [avaliacoes, filtros, equipesPorId]
  );
  const comFiltros = temAlgumFiltro(filtros);

  const resumoCriterios = useMemo(
    () =>
      CRITERIOS_RELATORIO.map(({ chave, rotulo }) => {
        const universo = aplicarFiltros(
          avaliacoes,
          filtros,
          chave,
          equipesPorId
        );
        const porValor: Record<CriterioEquipista, number> = {
          Otimo: 0,
          Bom: 0,
          Regular: 0,
          Ruim: 0,
        };
        for (const avaliacao of universo) {
          porValor[avaliacao.criterios[chave]] += 1;
        }
        return { chave, rotulo, porValor };
      }),
    [avaliacoes, filtros, equipesPorId]
  );

  function alternarValorCriterio(chave: CampoCriterio, valor: CriterioEquipista) {
    setFiltros((atual) => {
      const selecao = new Set(atual.criterios[chave] ?? []);
      if (selecao.has(valor)) {
        selecao.delete(valor);
      } else {
        selecao.add(valor);
      }
      const criterios = { ...atual.criterios };
      if (selecao.size === 0) {
        delete criterios[chave];
      } else {
        criterios[chave] = selecao;
      }
      return { ...atual, criterios };
    });
  }

  function alternarCampoSetorial(
    campo: "setores" | "equipes",
    chave: string
  ) {
    setFiltros((atual) => {
      const selecao = new Set(atual[campo]);
      if (selecao.has(chave)) {
        selecao.delete(chave);
      } else {
        selecao.add(chave);
      }
      return { ...atual, [campo]: selecao };
    });
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
  }

  return (
    <div className="space-y-4">
      {carregando && <p className="text-ardesia">Carregando...</p>}

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">
            Falha ao carregar as avaliações. Verifique a conexão e tente
            novamente mais tarde.
          </div>
        </div>
      )}

      {!carregando && !erro && (
        <>
          <div className="card">
            <div className="card-corpo flex flex-wrap items-center gap-2 py-3">
              <MenuFiltro
                aberto={dropdownAberto === "setores"}
                rotulo="Setores"
                opcoes={opcoesSetor.map((setor) => ({
                  chave: setor.valor,
                  rotulo: setor.rotulo,
                  marcado: filtros.setores.has(setor.valor),
                }))}
                aoAbrirFechar={() => alternarDropdown("setores")}
                aoMarcar={(chave) => alternarCampoSetorial("setores", chave)}
                aoLimparCampo={() => limparCampo("setores")}
                permitirBusca
                placeholderBusca="Buscar setor..."
              />

              <MenuFiltro
                aberto={dropdownAberto === "equipes"}
                rotulo="Equipes"
                opcoes={opcoesEquipe.map((equipe) => ({
                  chave: equipe.valor,
                  rotulo: equipe.rotulo,
                  marcado: filtros.equipes.has(equipe.valor),
                }))}
                aoAbrirFechar={() => alternarDropdown("equipes")}
                aoMarcar={(chave) => alternarCampoSetorial("equipes", chave)}
                aoLimparCampo={() => limparCampo("equipes")}
                permitirBusca
                placeholderBusca="Buscar equipe..."
              />

              <span
                className="h-6 w-px bg-pietra mx-1"
                aria-hidden="true"
              />

              {CRITERIOS_RELATORIO.map((grupo) => (
                <MenuFiltro
                  key={grupo.chave}
                  aberto={dropdownAberto === grupo.chave}
                  rotulo={grupo.rotulo}
                  opcoes={VALORES_CRITERIO.map((valor) => ({
                    chave: valor,
                    rotulo: ROTULO_VALOR[valor],
                    marcado:
                      filtros.criterios[grupo.chave]?.has(valor) ?? false,
                  }))}
                  aoAbrirFechar={() => alternarDropdown(grupo.chave)}
                  aoMarcar={(chave) =>
                    alternarValorCriterio(grupo.chave, chave as CriterioEquipista)
                  }
                  aoLimparCampo={() => limparCampo(grupo.chave)}
                />
              ))}

              {comFiltros && (
                <button
                  type="button"
                  className="btn-xs btn-secundario ml-auto"
                  onClick={limparFiltros}
                  aria-label="Limpar filtros"
                  title="Limpar filtros"
                >
                  <Icone nome="fechar" tamanho={16} />
                </button>
              )}
            </div>
          </div>

          <p className="text-ardesia text-sm">
            {edicaoNumero}ª edição ({edicaoAno})
          </p>

          {avaliacoes.length > 0 && (
            <div className="card">
              <div className="card-corpo space-y-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setResumoAberto((atual) => !atual)}
                  aria-expanded={resumoAberto}
                  aria-controls="resumo-avaliacoes-coordenador"
                >
                  <h3>Resumo</h3>
                  <Icone nome={resumoAberto ? "menos" : "mais"} tamanho={16} />
                </button>
                {resumoAberto && (
                  <div id="resumo-avaliacoes-coordenador" className="space-y-4">
                    <div className="kpi-grid">
                      <div className="kpi">
                        <div className="kpi-label">Avaliações na edição</div>
                        <div className="kpi-valor">{avaliacoes.length}</div>
                      </div>
                      <div className="kpi">
                        <div className="kpi-label">Após filtros</div>
                        <div className="kpi-valor">{filtradas.length}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                      {resumoCriterios.map(({ chave, rotulo, porValor }) => (
                        <div key={chave}>
                          <p className="input-label">{rotulo}</p>
                          <ul className="text-sm space-y-1 mt-1">
                            {VALORES_CRITERIO.map((valor) => (
                              <li key={valor} className="flex justify-between gap-2">
                                <span className="text-ardesia">
                                  {ROTULO_VALOR[valor]}
                                </span>
                                <span>{porValor[valor]}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h3>Resultado</h3>
            <span className="text-ardesia text-sm">
              {filtradas.length} de {avaliacoes.length} avaliações
              {comFiltros ? " com os filtros aplicados" : ""}
            </span>
          </div>

          {avaliacoes.length === 0 && (
            <div className="card">
              <div className="card-corpo text-ardesia">
                Nenhuma avaliação registrada nesta edição. As avaliações são
                feitas pelos equipistas no link público disponível na tela da
                edição.
              </div>
            </div>
          )}

          {avaliacoes.length > 0 && filtradas.length === 0 && (
            <div className="card">
              <div className="card-corpo text-ardesia space-y-3">
                <p>Nenhuma avaliação corresponde aos filtros aplicados.</p>
                <button
                  type="button"
                  className="btn-xs btn-secundario ml-auto"
                  onClick={limparFiltros}
                  aria-label="Limpar filtros"
                  title="Limpar filtros"
                >
                  <Icone nome="fechar" tamanho={16} />
                </button>
              </div>
            </div>
          )}

          {filtradas.map((avaliacao) => {
            return (
              <div key={avaliacao.id} className="card">
                <div className="card-corpo space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <span className="block font-semibold truncate">
                      {avaliacao.pessoaNome ?? "-"}
                      {avaliacao.pessoaCracha
                        ? ` · crachá ${avaliacao.pessoaCracha}`
                        : ""}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge badge-verde">Finalizada</span>
                    </div>
                  </div>
                  <span className="text-xs text-ardesia block">
                    {avaliacao.equipeNome ?? "-"} · Avaliador:{" "}
                    {avaliacao.avaliadorNome} · Atualizado em{" "}
                    {formatarMomento(avaliacao.atualizadoEm)}
                  </span>
                  <div className="text-sm grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
                    {CRITERIOS_RELATORIO.map(({ chave, rotulo }) => {
                      const valor = avaliacao.criterios[chave];
                      return (
                        <span key={chave}>
                          <span className="text-xs text-ardesia">{rotulo}</span>{" "}
                          <span
                            className="font-bold text-md font-display"
                            style={{ color: corValor(valor) }}
                          >
                            {ROTULO_VALOR[valor]}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-2 pt-4 border-t border-pietra-clara">
                    <p className="input-label">Comentários e sugestões</p>
                    {avaliacao.comentarios ? (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {avaliacao.comentarios}
                      </p>
                    ) : (
                      <p className="text-sm text-ardesia">—</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
