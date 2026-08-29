// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: avaliacao.gerenciar (mesmos perfis que gerenciam avaliacoes: ADM/ORG).
// Relatorio somente leitura das avaliacoes da edicao ativa (021), filtravel
// pelos valores possiveis de cada criterio. Fonte: GET /api/avaliacoes via
// hook useAvaliacoes — sem chamada nova na API.
// Semantica dos filtros: OR dentro do mesmo campo, AND entre campos.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import {
  useAvaliacoes,
  useDiasFesta,
  useEdicaoAtiva,
  useEquipes,
  usePresencasDaEdicao,
  useSetores,
} from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { Icone } from "../components/Icone";
import { formatarData, normalizar } from "../lib/utilsDominio";
import { SETORES } from "../lib/tipos";
import type {
  Avaliacao,
  CriteriosAvaliacao,
  NotaConvidarNovamente,
  ValorCriterio,
} from "../lib/tipos";

type CampoCriterio = Exclude<keyof CriteriosAvaliacao, "convidarNovamente">;

const VALORES_CRITERIO: ValorCriterio[] = ["Otimo", "Bom", "Regular", "Ruim"];

const ROTULO_VALOR: Record<ValorCriterio, string> = {
  Otimo: "Ótimo",
  Bom: "Bom",
  Regular: "Regular",
  Ruim: "Ruim",
};

const CRITERIOS_RELATORIO: { chave: CampoCriterio; rotulo: string }[] = [
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "dedicacao", rotulo: "Dedicação" },
  { chave: "companheirismo", rotulo: "Companheirismo" },
  { chave: "espiritualidade", rotulo: "Espiritualidade" },
  { chave: "comprometimento", rotulo: "Comprometimento" },
  { chave: "uniforme", rotulo: "Uniforme" },
];

const NOTAS_CONVIDAR: NotaConvidarNovamente[] = [1, 2, 3, 4, 5];

interface FiltrosRelatorio {
  setores: Set<string>;
  equipes: Set<string>;
  criterios: Partial<Record<CampoCriterio, Set<ValorCriterio>>>;
  convidarNovamente: Set<NotaConvidarNovamente>;
}

const FILTROS_INICIAIS: FiltrosRelatorio = {
  setores: new Set(),
  equipes: new Set(),
  criterios: {},
  convidarNovamente: new Set(),
};

function temAlgumFiltro(filtros: FiltrosRelatorio): boolean {
  if (filtros.setores.size > 0 || filtros.equipes.size > 0) return true;
  if (filtros.convidarNovamente.size > 0) return true;
  return CRITERIOS_RELATORIO.some(
    ({ chave }) => (filtros.criterios[chave]?.size ?? 0) > 0
  );
}

function campoAtivo(filtros: FiltrosRelatorio, chave: CampoCriterio): boolean {
  return (filtros.criterios[chave]?.size ?? 0) > 0;
}

// Filtra a listagem aplicando OR dentro de cada campo e AND entre campos.
// Valor ausente nunca satisfaz filtro ativo. Preserva a ordenacao recebida
// da API (atualizadoEm DESC).
//
// `excluir` remove um campo da conjuncao — usado pelo resumo para contar cada
// campo sobre o universo filtrado pelos demais. Setores/equipes entram sempre
// na conjuncao (nao sao excluidos pelo resumo).
function aplicarFiltros(
  avaliacoes: Avaliacao[],
  filtros: FiltrosRelatorio,
  excluir?: CampoCriterio | "convidarNovamente",
  equipesPorId?: Map<string, { setor: string; nome: string }>
): Avaliacao[] {
  const campos = CRITERIOS_RELATORIO.filter(
    ({ chave }) => chave !== excluir && campoAtivo(filtros, chave)
  );
  const filtrarConvidar =
    excluir !== "convidarNovamente" && filtros.convidarNovamente.size > 0;

  if (
    filtros.setores.size === 0 &&
    filtros.equipes.size === 0 &&
    campos.length === 0 &&
    !filtrarConvidar
  )
    return avaliacoes;

  return avaliacoes.filter((avaliacao) => {
    const atendeCriterios = campos.every(({ chave }) => {
      const valor = avaliacao.criterios[chave];
      return valor !== null && filtros.criterios[chave]!.has(valor);
    });
    const nota = avaliacao.criterios.convidarNovamente;
    const atendeConvidar =
      !filtrarConvidar ||
      (nota !== null && filtros.convidarNovamente.has(nota));

    const equipe = equipesPorId?.get(avaliacao.equipeId);
    const atendeSetores =
      filtros.setores.size === 0 ||
      (equipe !== undefined && filtros.setores.has(equipe.setor));
    const atendeEquipes =
      filtros.equipes.size === 0 || filtros.equipes.has(avaliacao.equipeId);

    return atendeCriterios && atendeConvidar && atendeSetores && atendeEquipes;
  });
}

function rotuloStatus(status: Avaliacao["status"]): string {
  return status === "finalizada" ? "Finalizada" : "Rascunho";
}

function badgeStatus(status: Avaliacao["status"]): string {
  return status === "finalizada" ? "badge badge-verde" : "badge badge-cinza";
}

// Cor do texto de um valor de criterio, conforme a paleta do guia visual.
function corValor(valor: ValorCriterio): string {
  switch (valor) {
    case "Otimo":
      return "text-verde-escuro";
    case "Bom":
      return "text-azul-texto";
    case "Regular":
      return "text-ouro-texto";
    case "Ruim":
      return "text-vermelho-escuro";
  }
}

// Escala de cor da nota de 1 (vermelho) a 5 (verde), igual ao formulario publico.
function corNotaConvidar(nota: NotaConvidarNovamente): string {
  const matiz = Math.round(((nota - 1) / (NOTAS_CONVIDAR.length - 1)) * 130);
  return `hsl(${matiz} 72% 38%)`;
}

// Dropdown multi-selecao de um campo do relatorio. O gatilho mostra o nome do
// campo e a quantidade de valores marcados; o painel lista os valores possiveis
// com caixas de marcacao. Fecha ao clicar fora ou com Escape (efeito no chamador).
// Quando `permitirBusca` e true, um campo de texto filtra as opcoes listadas.
function MenuFiltro(props: {
  aberto: boolean;
  rotulo: string;
  opcoes: { chave: string; rotulo: string; marcado: boolean }[];
  aoAbrirFechar: () => void;
  aoMarcar: (chave: string) => void;
  aoLimparCampo: () => void;
  permitirBusca?: boolean;
  placeholderBusca?: string;
}) {
  const {
    aberto,
    rotulo,
    opcoes,
    aoAbrirFechar,
    aoMarcar,
    aoLimparCampo,
    permitirBusca = false,
    placeholderBusca = "Buscar...",
  } = props;
  const quantidade = opcoes.filter((opcao) => opcao.marcado).length;
  const [busca, setBusca] = useState("");

  // Limpa a busca sempre que o painel fecha, para o filtro nao vazar entre aberturas.
  useEffect(() => {
    if (!aberto) setBusca("");
  }, [aberto]);

  const opcoesFiltradas = useMemo(() => {
    if (!permitirBusca || !busca.trim()) return opcoes;
    const termo = normalizar(busca);
    return opcoes.filter((opcao) => normalizar(opcao.rotulo).includes(termo));
  }, [opcoes, permitirBusca, busca]);

  return (
    <div className="relative" data-dropdown>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={aberto}
        className={`filtro-chip ${
          aberto || quantidade > 0
            ? "filtro-chip-ativo"
            : "filtro-chip-inativo"
        }`}
        onClick={aoAbrirFechar}
        title={rotulo}
      >
        {rotulo}
        {quantidade > 0 && <span className="tabular-nums">({quantidade})</span>}
        <Icone nome="seta-baixo" tamanho={12} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[190px] rounded-lg border border-pietra bg-bianco shadow-media p-2">
          {permitirBusca && (
            <div className="relative mb-1">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ardesia">
                <Icone nome="busca" tamanho={14} />
              </span>
              <input
                type="text"
                className="input pl-8"
                placeholder={placeholderBusca}
                aria-label={`Buscar ${rotulo}`}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto">
            {opcoesFiltradas.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-ardesia">
                Nenhuma opção encontrada.
              </p>
            ) : (
              opcoesFiltradas.map((opcao) => (
                <label
                  key={opcao.chave}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-pietra-clara cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-verde"
                    checked={opcao.marcado}
                    onChange={() => aoMarcar(opcao.chave)}
                  />
                  {opcao.rotulo}
                </label>
              ))
            )}
          </div>
          {quantidade > 0 && (
            <button
              type="button"
              className="btn btn-texto w-full mt-1"
              onClick={aoLimparCampo}
            >
              <span className="text-xs">Limpar campo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
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

export function RelatorioAvaliacoes() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: avaliacoes, carregando, erro } = useAvaliacoes(edicao?.id);
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: setores } = useSetores();
  const { itens: diasFesta } = useDiasFesta(edicao?.id);
  const [filtros, setFiltros] = useState<FiltrosRelatorio>(FILTROS_INICIAIS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
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

  function limparCampo(
    chave: "setores" | "equipes" | CampoCriterio | "convidarNovamente"
  ) {
    if (chave === "setores" || chave === "equipes") {
      setFiltros((atual) => ({ ...atual, [chave]: new Set() }));
      return;
    }
    if (chave === "convidarNovamente") {
      setFiltros((atual) => ({ ...atual, convidarNovamente: new Set() }));
      return;
    }
    setFiltros((atual) => {
      const criterios = { ...atual.criterios };
      delete criterios[chave];
      return { ...atual, criterios };
    });
  }

  function alternarDetalhe(id: string) {
    setDetalheAbertoId((atual) => (atual === id ? null : id));
  }

  // Dias de festa da edicao (ordenados) e presencas de todos os dias, para o
  // quadro de presenca de cada pessoa avaliada.
  const diasOrdenados = useMemo(
    () =>
      [...diasFesta].sort((a, b) => a.data.localeCompare(b.data)),
    [diasFesta]
  );
  const { itens: presencas, carregando: carregandoPresencas } =
    usePresencasDaEdicao(edicao?.id, diasOrdenados);

  // pessoaId -> conjunto de diaFestaId onde a pessoa esteve presente.
  const diasPresentesPorPessoa = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const pr of presencas) {
      let conjunto = m.get(pr.pessoaId);
      if (!conjunto) {
        conjunto = new Set<string>();
        m.set(pr.pessoaId, conjunto);
      }
      conjunto.add(pr.diaFestaId);
    }
    return m;
  }, [presencas]);

  const hoje = useMemo(() => {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }, []);

  // Setores de equipes desta edicao: usa o catalogo editavel quando existir,
  // senao o catalogo fixo (mesma logica do formulario de equipe).
  const opcoesSetor = useMemo(() => {
    if (setores.length > 0) {
      return setores.map((s) => ({ valor: s.id, rotulo: s.nome }));
    }
    return SETORES.map((s) => ({ valor: s.valor, rotulo: s.rotulo }));
  }, [setores]);

  // Mapa equipeId -> { setor, nome } para resolver setor/equipe das avaliacoes.
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

  // Contagem de cada campo sobre o universo filtrado pelos demais campos,
  // para o resumo nao zerar quando o proprio valor esta filtrado.
  const resumoCriterios = useMemo(
    () =>
      CRITERIOS_RELATORIO.map(({ chave, rotulo }) => {
        const universo = aplicarFiltros(
          avaliacoes,
          filtros,
          chave,
          equipesPorId
        );
        const porValor: Record<ValorCriterio, number> = {
          Otimo: 0,
          Bom: 0,
          Regular: 0,
          Ruim: 0,
        };
        for (const avaliacao of universo) {
          const valor = avaliacao.criterios[chave];
          if (valor !== null) porValor[valor] += 1;
        }
        return { chave, rotulo, porValor };
      }),
    [avaliacoes, filtros, equipesPorId]
  );

  const resumoConvidar = useMemo(() => {
    const universo = aplicarFiltros(
      avaliacoes,
      filtros,
      "convidarNovamente",
      equipesPorId
    );
    const porNota: Record<NotaConvidarNovamente, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const avaliacao of universo) {
      const nota = avaliacao.criterios.convidarNovamente;
      if (nota !== null) porNota[nota] += 1;
    }
    return porNota;
  }, [avaliacoes, filtros, equipesPorId]);

  function alternarValorCriterio(chave: CampoCriterio, valor: ValorCriterio) {
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

  function alternarNotaConvidar(nota: NotaConvidarNovamente) {
    setFiltros((atual) => {
      const convidarNovamente = new Set(atual.convidarNovamente);
      if (convidarNovamente.has(nota)) {
        convidarNovamente.delete(nota);
      } else {
        convidarNovamente.add(nota);
      }
      return { ...atual, convidarNovamente };
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

  if (!sessao) return null;
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização acessam o relatório de avaliações.
          </p>
        </div>
      </div>
    );
  }

  if (carregandoEdicao) {
    return (
      <div className="card">
        <div className="card-corpo text-ardesia">Carregando...</div>
      </div>
    );
  }

  if (!edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem edição ativa</h3>
          <p className="text-ardesia">
            Marque uma edição como ativa para consultar as avaliações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Relatórios</div>
        <h2 className="mt-1">Avaliações</h2>
      </header>

      {carregando && (
        <div className="card">
          <div className="card-corpo text-ardesia">Carregando...</div>
        </div>
      )}

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
                    alternarValorCriterio(grupo.chave, chave as ValorCriterio)
                  }
                  aoLimparCampo={() => limparCampo(grupo.chave)}
                />
              ))}

              <MenuFiltro
                aberto={dropdownAberto === "convidarNovamente"}
                rotulo="Convidar"
                opcoes={NOTAS_CONVIDAR.map((nota) => ({
                  chave: String(nota),
                  rotulo: `${nota} de 5`,
                  marcado: filtros.convidarNovamente.has(nota),
                }))}
                aoAbrirFechar={() => alternarDropdown("convidarNovamente")}
                aoMarcar={(chave) =>
                  alternarNotaConvidar(Number(chave) as NotaConvidarNovamente)
                }
                aoLimparCampo={() => limparCampo("convidarNovamente")}
              />

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

          {avaliacoes.length > 0 && (
            <div className="card">
              <div className="card-corpo space-y-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setResumoAberto((atual) => !atual)}
                  aria-expanded={resumoAberto}
                  aria-controls="resumo-avaliacoes"
                >
                  <h3>Resumo</h3>
                  <Icone nome={resumoAberto ? "menos" : "mais"} tamanho={16} />
                </button>
                {resumoAberto && (
                  <div id="resumo-avaliacoes" className="space-y-4">
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
                  <div>
                    <p className="input-label">Chances de convidar novamente</p>
                    <ul className="text-sm space-y-1 mt-1">
                      {NOTAS_CONVIDAR.map((nota) => (
                        <li key={nota} className="flex justify-between gap-2">
                          <span className="text-ardesia">{nota} de 5</span>
                          <span>{resumoConvidar[nota]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
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
                feitas pelos coordenadores no link público disponível na tela
                da edição.
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
            const aberto = detalheAbertoId === avaliacao.id;
            return (
              <div key={avaliacao.id} className="card">
                <div className="card-corpo space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => alternarDetalhe(avaliacao.id)}
                      aria-expanded={aberto}
                      aria-label={`${
                        aberto ? "Fechar detalhes de" : "Ver detalhes de"
                      } ${avaliacao.pessoaNome ?? "avaliação"}`}
                      title={aberto ? "Fechar detalhes" : "Ver detalhes"}
                    >
                      <span className="block font-semibold truncate">
                        {avaliacao.pessoaNome ?? "-"}
                        {avaliacao.pessoaCracha
                          ? ` · crachá ${avaliacao.pessoaCracha}`
                          : ""}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="flex items-center gap-0.5 whitespace-nowrap"
                        title="Presença nos dias de festa"
                      >
                        {diasOrdenados.map((dia, indice) => {
                          const presente =
                            diasPresentesPorPessoa
                              .get(avaliacao.pessoaId)
                              ?.has(dia.id) ?? false;
                          const futuro = dia.data > hoje;
                          const classe =
                            carregandoPresencas || futuro
                              ? "bg-pietra-clara text-ardesia"
                              : presente
                                ? "bg-verde text-white"
                                : "bg-vermelho text-white";
                          return (
                            <div
                              key={dia.id}
                              title={`Dia ${indice + 1} · ${formatarData(
                                dia.data
                              )}`}
                              className={`w-6 h-6 rounded-sm flex items-center justify-center font-mono text-xs font-semibold select-none ${classe}`}
                            >
                              {indice + 1}
                            </div>
                          );
                        })}
                      </div>
                      <span className={badgeStatus(avaliacao.status)}>
                        {rotuloStatus(avaliacao.status)}
                      </span>
                      <Icone nome={aberto ? "menos" : "mais"} tamanho={16} />
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
                            className={
                              valor !== null
                                ? `font-bold text-md font-display ${corValor(valor)}`
                                : ""
                            }
                          >
                            {valor !== null ? ROTULO_VALOR[valor] : "-"}
                          </span>
                        </span>
                      );
                    })}
                    <span>
                      <span className="text-xs text-ardesia">Convidar novamente</span>{" "}
                      {avaliacao.criterios.convidarNovamente !== null ? (
                        <span
                          className="font-bold text-md font-display"
                          style={{
                            color: corNotaConvidar(
                              avaliacao.criterios.convidarNovamente,
                            ),
                          }}
                        >
                          {avaliacao.criterios.convidarNovamente}/5
                        </span>
                      ) : (
                        "-"
                      )}
                    </span>
                    <span>
                      <span className="text-xs text-ardesia">Apta a coordenar</span>{" "}
                      {avaliacao.aptoCoordenar === null ? (
                        "-"
                      ) : (
                        <span
                          className={`font-bold text-md font-display ${
                            avaliacao.aptoCoordenar
                              ? "text-verde-escuro"
                              : "text-vermelho-escuro"
                          }`}
                        >
                          {avaliacao.aptoCoordenar ? "Sim" : "Não"}
                        </span>
                      )}
                    </span>
                  </div>

                  {aberto && (
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
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
