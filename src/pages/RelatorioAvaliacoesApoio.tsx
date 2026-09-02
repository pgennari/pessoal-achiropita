// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: avaliacao.gerenciar (mesmos perfis que gerenciam avaliacoes: ADM/ORG),
// garantida pelo pai (RelatorioAvaliacoes) antes de renderizar.
// Relatorio somente leitura das avaliacoes de coordenadores (equipes filhas)
// da edicao ativa, com filtros multi-selecao, resumo e cartoes expandiveis.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { useAvaliacoesCoordenador, useEquipes } from "../lib/hooks";
import { Icone } from "../components/Icone";
import { MenuFiltro } from "../components/MenuFiltro";
import {
  PermanenciaCoordenador,
  LiderancaCoordenador,
  OPCOES_PERMANENCIA,
  OPCOES_LIDERANCA,
} from "../lib/tipos";

type CampoFiltro = "equipes" | "avaliadores" | "status" | "permanencia" | "lideranca";

interface Props {
  edicaoId: string;
  edicaoNumero: number;
  edicaoAno: number;
}

const PERMANENCIA_ROTULO: Record<PermanenciaCoordenador, string> = {
  Sim: "Sim",
  "Sim, com algumas ressalvas": "Sim, com algumas ressalvas",
  "Nao tenho certeza": "Não tenho certeza",
  Nao: "Não",
};

const PERMANENCIA_COR: Record<PermanenciaCoordenador, string> = {
  Sim: "#16a34a",
  "Sim, com algumas ressalvas": "#2563eb",
  "Nao tenho certeza": "#ca8a04",
  Nao: "#dc2626",
};

const LIDERANCA_ROTULO: Record<LiderancaCoordenador, string> = {
  Excelente: "Excelente",
  Bom: "Bom",
  Regular: "Regular",
  Pouco: "Pouco",
  "Nao possui": "Não possui",
};

const LIDERANCA_COR: Record<LiderancaCoordenador, string> = {
  Excelente: "#16a34a",
  Bom: "#2563eb",
  Regular: "#ca8a04",
  Pouco: "#dc2626",
  "Nao possui": "#dc2626",
};

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

function temAlgumFiltro(filtros: {
  equipes: Set<string>;
  avaliadores: Set<string>;
  status: Set<string>;
  permanencia: Set<string>;
  lideranca: Set<string>;
}): boolean {
  return (
    filtros.equipes.size > 0 ||
    filtros.avaliadores.size > 0 ||
    filtros.status.size > 0 ||
    filtros.permanencia.size > 0 ||
    filtros.lideranca.size > 0
  );
}

export function RelatorioAvaliacoesApoio({ edicaoId, edicaoNumero, edicaoAno }: Props) {
  const { itens: equipes } = useEquipes(edicaoId);
  const { itens: avaliacoes, carregando, erro } = useAvaliacoesCoordenador(edicaoId);

  const [equipesFiltro, setEquipesFiltro] = useState<Set<string>>(new Set());
  const [avaliadoresFiltro, setAvaliadoresFiltro] = useState<Set<string>>(new Set());
  const [statusFiltro, setStatusFiltro] = useState<Set<string>>(new Set());
  const [permanenciaFiltro, setPermanenciaFiltro] = useState<Set<string>>(new Set());
  const [liderancaFiltro, setLiderancaFiltro] = useState<Set<string>>(new Set());
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null);
  const [resumoAberto, setResumoAberto] = useState(false);

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

  function alternarCampo(campo: CampoFiltro, chave: string) {
    const setter =
      campo === "equipes"
        ? setEquipesFiltro
        : campo === "avaliadores"
          ? setAvaliadoresFiltro
          : campo === "status"
            ? setStatusFiltro
            : campo === "permanencia"
              ? setPermanenciaFiltro
              : setLiderancaFiltro;
    setter((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function limparCampo(campo: CampoFiltro) {
    if (campo === "equipes") setEquipesFiltro(new Set());
    else if (campo === "avaliadores") setAvaliadoresFiltro(new Set());
    else if (campo === "status") setStatusFiltro(new Set());
    else if (campo === "permanencia") setPermanenciaFiltro(new Set());
    else setLiderancaFiltro(new Set());
  }

  function limparFiltros() {
    setEquipesFiltro(new Set());
    setAvaliadoresFiltro(new Set());
    setStatusFiltro(new Set());
    setPermanenciaFiltro(new Set());
    setLiderancaFiltro(new Set());
  }

  const avaliadores = useMemo(() => {
    const vistos = new Set<string>();
    const lista: { pessoaId: string; nome: string }[] = [];
    for (const a of avaliacoes) {
      if (a.avaliadorPessoaId && !vistos.has(a.avaliadorPessoaId)) {
        vistos.add(a.avaliadorPessoaId);
        lista.push({ pessoaId: a.avaliadorPessoaId, nome: a.avaliadorNome });
      }
    }
    return lista.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  }, [avaliacoes]);

  const opcoesEquipe = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const a of avaliacoes) {
      if (a.equipeFilhaId && a.equipeFilhaNome && !vistos.has(a.equipeFilhaId)) {
        vistos.set(a.equipeFilhaId, a.equipeFilhaNome);
      }
    }
    if (vistos.size === 0) {
      return equipes
        .filter((e) => e.equipePaiId)
        .map((e) => ({ valor: e.id, rotulo: e.nome }));
    }
    return Array.from(vistos.entries())
      .map(([id, nome]) => ({ valor: id, rotulo: nome }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [avaliacoes, equipes]);

  const filtradas = useMemo(() => {
    return avaliacoes.filter((a) => {
      if (equipesFiltro.size > 0 && !equipesFiltro.has(a.equipeFilhaId)) return false;
      if (avaliadoresFiltro.size > 0 && !avaliadoresFiltro.has(a.avaliadorPessoaId)) return false;
      if (statusFiltro.size > 0 && !statusFiltro.has(a.status)) return false;
      if (permanenciaFiltro.size > 0 && (!a.permanencia || !permanenciaFiltro.has(a.permanencia))) return false;
      if (liderancaFiltro.size > 0 && (!a.lideranca || !liderancaFiltro.has(a.lideranca))) return false;
      return true;
    });
  }, [avaliacoes, equipesFiltro, avaliadoresFiltro, statusFiltro, permanenciaFiltro, liderancaFiltro]);

  const comFiltros = temAlgumFiltro({
    equipes: equipesFiltro,
    avaliadores: avaliadoresFiltro,
    status: statusFiltro,
    permanencia: permanenciaFiltro,
    lideranca: liderancaFiltro,
  });

  const resumoPermanencia = useMemo(() => {
    const porValor: Record<PermanenciaCoordenador, number> = {
      Sim: 0,
      "Sim, com algumas ressalvas": 0,
      "Nao tenho certeza": 0,
      Nao: 0,
    };
    for (const a of filtradas) {
      if (a.permanencia) porValor[a.permanencia] += 1;
    }
    return porValor;
  }, [filtradas]);

  const resumoLideranca = useMemo(() => {
    const porValor: Record<LiderancaCoordenador, number> = {
      Excelente: 0,
      Bom: 0,
      Regular: 0,
      Pouco: 0,
      "Nao possui": 0,
    };
    for (const a of filtradas) {
      if (a.lideranca) porValor[a.lideranca] += 1;
    }
    return porValor;
  }, [filtradas]);

  return (
    <div className="space-y-4">
      {carregando && <p className="text-ardesia">Carregando...</p>}

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">
            Falha ao carregar as avaliações. Verifique a conexão e tente novamente mais tarde.
          </div>
        </div>
      )}

      {!carregando && !erro && (
        <>
          <div className="card">
            <div className="card-corpo flex flex-wrap items-center gap-2 py-3">
              <MenuFiltro
                aberto={dropdownAberto === "equipes"}
                rotulo="Equipe filha"
                opcoes={opcoesEquipe.map((e) => ({
                  chave: e.valor,
                  rotulo: e.rotulo,
                  marcado: equipesFiltro.has(e.valor),
                }))}
                aoAbrirFechar={() => alternarDropdown("equipes")}
                aoMarcar={(chave) => alternarCampo("equipes", chave)}
                aoLimparCampo={() => limparCampo("equipes")}
                permitirBusca
                placeholderBusca="Buscar equipe..."
              />

              <MenuFiltro
                aberto={dropdownAberto === "avaliadores"}
                rotulo="Avaliador"
                opcoes={avaliadores.map((a) => ({
                  chave: a.pessoaId,
                  rotulo: a.nome,
                  marcado: avaliadoresFiltro.has(a.pessoaId),
                }))}
                aoAbrirFechar={() => alternarDropdown("avaliadores")}
                aoMarcar={(chave) => alternarCampo("avaliadores", chave)}
                aoLimparCampo={() => limparCampo("avaliadores")}
                permitirBusca
                placeholderBusca="Buscar avaliador..."
              />

              <span className="h-6 w-px bg-pietra mx-1" aria-hidden="true" />

              <MenuFiltro
                aberto={dropdownAberto === "status"}
                rotulo="Status"
                opcoes={[
                  { chave: "rascunho", rotulo: "Rascunho", marcado: statusFiltro.has("rascunho") },
                  { chave: "finalizada", rotulo: "Finalizada", marcado: statusFiltro.has("finalizada") },
                ]}
                aoAbrirFechar={() => alternarDropdown("status")}
                aoMarcar={(chave) => alternarCampo("status", chave)}
                aoLimparCampo={() => limparCampo("status")}
              />

              <span className="h-6 w-px bg-pietra mx-1" aria-hidden="true" />

              <MenuFiltro
                aberto={dropdownAberto === "permanencia"}
                rotulo="Permanência"
                opcoes={OPCOES_PERMANENCIA.map(({ valor, rotulo }) => ({
                  chave: valor,
                  rotulo,
                  marcado: permanenciaFiltro.has(valor),
                }))}
                aoAbrirFechar={() => alternarDropdown("permanencia")}
                aoMarcar={(chave) => alternarCampo("permanencia", chave)}
                aoLimparCampo={() => limparCampo("permanencia")}
              />

              <MenuFiltro
                aberto={dropdownAberto === "lideranca"}
                rotulo="Liderança"
                opcoes={OPCOES_LIDERANCA.map(({ valor, rotulo }) => ({
                  chave: valor,
                  rotulo,
                  marcado: liderancaFiltro.has(valor),
                }))}
                aoAbrirFechar={() => alternarDropdown("lideranca")}
                aoMarcar={(chave) => alternarCampo("lideranca", chave)}
                aoLimparCampo={() => limparCampo("lideranca")}
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
                  aria-controls="resumo-avaliacoes-apoio"
                >
                  <h3>Resumo</h3>
                  <Icone nome={resumoAberto ? "menos" : "mais"} tamanho={16} />
                </button>
                {resumoAberto && (
                  <div id="resumo-avaliacoes-apoio" className="space-y-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      <div>
                        <p className="input-label">Permanência</p>
                        <ul className="text-sm space-y-1 mt-1">
                          {OPCOES_PERMANENCIA.map(({ valor, rotulo }) => (
                            <li key={valor} className="flex justify-between gap-2">
                              <span className="text-ardesia">{rotulo}</span>
                              <span>{resumoPermanencia[valor]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="input-label">Liderança</p>
                        <ul className="text-sm space-y-1 mt-1">
                          {OPCOES_LIDERANCA.map(({ valor, rotulo }) => (
                            <li key={valor} className="flex justify-between gap-2">
                              <span className="text-ardesia">{rotulo}</span>
                              <span>{resumoLideranca[valor]}</span>
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
                Nenhuma avaliação registrada nesta edição. As avaliações são feitas pelos
                coordenadores de apoio no link público disponível na tela da edição.
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

          {filtradas.map((avaliacao) => (
            <div key={avaliacao.id} className="card">
              <div className="card-corpo space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <span className="block font-semibold truncate">
                    {avaliacao.pessoaNome ?? "-"}
                    {avaliacao.pessoaCracha ? ` · crachá ${avaliacao.pessoaCracha}` : ""}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`badge ${avaliacao.status === "finalizada" ? "badge-verde" : "badge-azul"}`}
                    >
                      {avaliacao.status === "finalizada" ? "Finalizada" : "Rascunho"}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-ardesia block">
                  {avaliacao.equipeFilhaNome ?? "-"} · Avaliador:{" "}
                  {avaliacao.avaliadorNome} · Atualizado em{" "}
                  {formatarMomento(avaliacao.atualizadoEm)}
                </span>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <span>
                    <span className="text-xs text-ardesia">Permanência</span>{" "}
                    {avaliacao.permanencia ? (
                      <span
                        className="font-bold font-display"
                        style={{ color: PERMANENCIA_COR[avaliacao.permanencia] }}
                      >
                        {PERMANENCIA_ROTULO[avaliacao.permanencia]}
                      </span>
                    ) : (
                      <span className="text-ardesia italic">—</span>
                    )}
                  </span>
                  <span>
                    <span className="text-xs text-ardesia">Liderança</span>{" "}
                    {avaliacao.lideranca ? (
                      <span
                        className="font-bold font-display"
                        style={{ color: LIDERANCA_COR[avaliacao.lideranca] }}
                      >
                        {LIDERANCA_ROTULO[avaliacao.lideranca]}
                      </span>
                    ) : (
                      <span className="text-ardesia italic">—</span>
                    )}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-pietra-clara">
                  {[
                    { rotulo: "Ponto positivo", valor: avaliacao.pontoPositivo },
                    { rotulo: "Aspecto que pode melhorar", valor: avaliacao.aspectoMelhorar },
                    { rotulo: "Situação relevante a registrar", valor: avaliacao.situacaoRegistrar },
                    { rotulo: "Recomendação", valor: avaliacao.recomendacao },
                  ].map((q) => (
                    <div key={q.rotulo}>
                      <p className="input-label">{q.rotulo}</p>
                      {q.valor ? (
                        <p className="text-sm whitespace-pre-wrap break-words">{q.valor}</p>
                      ) : (
                        <p className="text-sm text-ardesia">—</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
