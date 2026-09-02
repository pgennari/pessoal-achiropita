// ============================================================================
// CONTROLE DE PERMISSAO
// Ver: permissao "presenca.relatorio". Sem a permissao exibe bloco "Sem permissao".
// Dados montados no cliente a partir dos hooks existentes (pessoas, equipes,
// participacoes, dias de festa e presencas por dia) — sem chamada nova na API.
// ============================================================================
import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  useDiasFesta,
  useEdicaoAtiva,
  useEquipes,
  useParticipacoes,
  usePessoas,
  usePresencasDaEdicao,
  useSetores,
} from "../lib/hooks";
import { Icone } from "../components/Icone";
import { dispararCsv, escaparCsv, montarTsv } from "../lib/csv";
import { formatarData, normalizar } from "../lib/utilsDominio";
import { SETORES } from "../lib/tipos";
import type { Funcao } from "../lib/tipos";

interface LinhaRelatorio {
  pessoaId: string;
  equipeNome: string;
  cracha: number;
  pessoaNome: string;
  funcao: Funcao;
  total: number;
  diasPresentes: Set<string>;
}

type ColunaOrdenacao = "equipe" | "nome" | "funcao" | "total";
type FiltroPresenca = "todos" | "presentes" | "ausentes";

// Cores de fallback dos setores iniciais (iguais ao seed em schema.sql);
// a cor real vem de setores via API quando disponivel.
const CORES_SETOR_PADRAO: Record<string, string> = {
  Interna: "#1f7b4d",
  Externa: "#c95a2b",
  Alimentacao: "#b8860b",
};

function infoSetor(
  setor: string,
  setoresPorId: Map<string, { nome: string; cor: string }>
): { rotulo: string; cor: string } {
  const viaApi = setoresPorId.get(setor);
  if (viaApi) return { rotulo: viaApi.nome, cor: viaApi.cor };
  const estatico = SETORES.find((s) => s.valor === setor);
  return {
    rotulo: estatico?.rotulo ?? setor,
    cor: CORES_SETOR_PADRAO[setor] ?? "#888",
  };
}

function dataLocalISO(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

type AbaRelatorio = "pessoas" | "equipes-sem-presenca";

// Item do relatorio "Equipes sem presenca": um dia de festa e as equipes dessa
// edicao que nao tiveram nenhuma presenca registrada naquele dia.
interface EquipesSemPresencaDia {
  diaId: string;
  data: string;
  equipes: { id: string; nome: string; setor: string }[];
}

export function RelatorioPresenca() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: dias } = useDiasFesta(edicao?.id);
  const { itens: pessoas, carregando: carregandoPessoas, erro: erroPessoas } = usePessoas();
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: setores } = useSetores();

  const [aba, setAba] = useState<AbaRelatorio>("pessoas");
  const [filtroEquipe, setFiltroEquipe] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroFuncao, setFiltroFuncao] = useState("");
  const [filtroTotal, setFiltroTotal] = useState<number | null>(null);
  const [filtroPresenca, setFiltroPresenca] = useState<FiltroPresenca>("todos");
  const [diasSelecionados, setDiasSelecionados] = useState<Set<string>>(new Set());
  const [filtroDiasAberto, setFiltroDiasAberto] = useState(false);
  const [colunaOrdenada, setColunaOrdenada] = useState<ColunaOrdenacao>("equipe");
  const [ordemAsc, setOrdemAsc] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const diasOrdenados = useMemo(
    () => [...dias].sort((a, b) => a.data.localeCompare(b.data)),
    [dias]
  );
  const { itens: presencas, carregando: carregandoPresencas } =
    usePresencasDaEdicao(edicao?.id, diasOrdenados);

  const diasConsiderados = useMemo(
    () =>
      diasSelecionados.size > 0
        ? diasOrdenados.filter((d) => diasSelecionados.has(d.id))
        : diasOrdenados,
    [diasOrdenados, diasSelecionados]
  );

  const podeVer = temPermissao(sessao, "presenca.relatorio");

  const pessoasPorId = useMemo(
    () =>
      new Map(
        pessoas
          .filter((p) => p.ativo)
          .map((p) => [p.id, p] as const)
      ),
    [pessoas]
  );
  const equipesPorId = useMemo(
    () => new Map(equipes.map((e) => [e.id, e.nome] as const)),
    [equipes]
  );
  const setoresPorId = useMemo(() => {
    const m = new Map<string, { nome: string; cor: string }>();
    for (const s of setores) m.set(s.id, { nome: s.nome, cor: s.cor });
    return m;
  }, [setores]);

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

  const linhas = useMemo<LinhaRelatorio[]>(() => {
    return participacoes
      .filter((part) => pessoasPorId.has(part.pessoaId))
      .map((part) => {
        const pessoa = pessoasPorId.get(part.pessoaId)!;
        const diasPresentes =
          diasPresentesPorPessoa.get(part.pessoaId) ?? new Set<string>();
        return {
          pessoaId: part.pessoaId,
          equipeNome: equipesPorId.get(part.equipeId) ?? "—",
          cracha: pessoa.cracha,
          pessoaNome: pessoa.nome,
          funcao: part.funcao,
          total: diasPresentes.size,
          diasPresentes,
        };
      });
  }, [participacoes, pessoasPorId, equipesPorId, diasPresentesPorPessoa]);

  const linhasFiltradas = useMemo(() => {
    const e = normalizar(filtroEquipe);
    const n = normalizar(filtroNome);
    const f = normalizar(filtroFuncao);
    const crachaDigitado = filtroNome.trim();

    const resultado = linhas.filter((linha) => {
      if (e && !normalizar(linha.equipeNome).includes(e)) return false;
      if (n) {
        if (
          !normalizar(linha.pessoaNome).includes(n) &&
          !String(linha.cracha).includes(crachaDigitado)
        )
          return false;
      }
      if (f && !normalizar(linha.funcao).includes(f)) return false;
      if (filtroTotal !== null && linha.total !== filtroTotal) return false;
      if (filtroPresenca !== "todos") {
        const noRecorte =
          filtroPresenca === "presentes"
            ? diasConsiderados.some((dia) => linha.diasPresentes.has(dia.id))
            : diasConsiderados.every((dia) => !linha.diasPresentes.has(dia.id));
        if (!noRecorte) return false;
      } else if (diasSelecionados.size > 0) {
        const presenteEmAlgum = Array.from(diasSelecionados).some((diaId) =>
          linha.diasPresentes.has(diaId)
        );
        if (!presenteEmAlgum) return false;
      }
      return true;
    });

    const multiplicador = ordemAsc ? 1 : -1;
    return resultado.sort((a, b) => {
      let cmp = 0;
      switch (colunaOrdenada) {
        case "equipe":
          cmp = a.equipeNome.localeCompare(b.equipeNome, "pt-BR");
          if (cmp === 0)
            cmp = a.pessoaNome.localeCompare(b.pessoaNome, "pt-BR");
          break;
        case "nome":
          cmp = a.pessoaNome.localeCompare(b.pessoaNome, "pt-BR");
          if (cmp === 0) cmp = a.cracha - b.cracha;
          break;
        case "funcao":
          cmp = a.funcao.localeCompare(b.funcao, "pt-BR");
          if (cmp === 0)
            cmp = a.pessoaNome.localeCompare(b.pessoaNome, "pt-BR");
          break;
        case "total":
          cmp = a.total - b.total;
          if (cmp === 0)
            cmp = a.pessoaNome.localeCompare(b.pessoaNome, "pt-BR");
          break;
      }
      return cmp * multiplicador;
    });
  }, [
    linhas,
    filtroEquipe,
    filtroNome,
    filtroFuncao,
    filtroTotal,
    filtroPresenca,
    diasConsiderados,
    diasSelecionados,
    colunaOrdenada,
    ordemAsc,
  ]);

  // Equipes ativas (nao excluidas) da edicao, ordenadas por nome.
  const equipesValidas = useMemo(
    () =>
      equipes
        .filter((e) => !e.excluida)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [equipes]
  );

  // Equipes com ao menos uma presenca registrada, por dia de festa.
  const equipesComPresencaPorDia = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const pr of presencas) {
      let conjunto = m.get(pr.diaFestaId);
      if (!conjunto) {
        conjunto = new Set<string>();
        m.set(pr.diaFestaId, conjunto);
      }
      conjunto.add(pr.equipeId);
    }
    return m;
  }, [presencas]);

  // Para cada dia de festa, as equipes sem nenhuma presenca registrada.
  const equipesSemPresencaPorDia = useMemo<EquipesSemPresencaDia[]>(
    () =>
      diasOrdenados.map((dia) => {
        const equipesComPresenca = equipesComPresencaPorDia.get(dia.id);
        const semPresenca = equipesValidas.filter(
          (e) => !equipesComPresenca?.has(e.id)
        );
        return {
          diaId: dia.id,
          data: dia.data,
          equipes: semPresenca.map((e) => ({
            id: e.id,
            nome: e.nome,
            setor: e.setor,
          })),
        };
      }),
    [diasOrdenados, equipesValidas, equipesComPresencaPorDia]
  );

  const totalEquipesSemPresenca = useMemo(
    () =>
      equipesSemPresencaPorDia.reduce((soma, dia) => soma + dia.equipes.length, 0),
    [equipesSemPresencaPorDia]
  );

  function exportarEquipesSemPresencaCsv() {
    const header = ["data", "pasta", "equipe"];
    const corpo: string[] = [];
    for (const dia of equipesSemPresencaPorDia) {
      for (const equipe of dia.equipes) {
        corpo.push(
          [formatarData(dia.data), infoSetor(equipe.setor, setoresPorId).rotulo, equipe.nome]
            .map(escaparCsv)
            .join(",")
        );
      }
    }
    const csv = [header.join(","), ...corpo].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    dispararCsv(`equipes-sem-presenca-${stamp}.csv`, csv);
  }

  function montarEquipesSemPresencaTsv(): string {
    const cabecalho = ["data", "pasta", "equipe"];
    const linhas = equipesSemPresencaPorDia.flatMap((dia) =>
      dia.equipes.map((equipe) => [
        formatarData(dia.data),
        infoSetor(equipe.setor, setoresPorId).rotulo,
        equipe.nome,
      ])
    );
    return montarTsv(cabecalho, linhas);
  }

  function copiarEquipesSemPresenca() {
    navigator.clipboard
      .writeText(montarEquipesSemPresencaTsv())
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => setCopiado(false));
  }

  function toggleOrdenacao(coluna: ColunaOrdenacao) {
    if (colunaOrdenada === coluna) {
      setOrdemAsc((atual) => !atual);
    } else {
      setColunaOrdenada(coluna);
      setOrdemAsc(true);
    }
  }

  const filtrosAtivos =
    filtroEquipe !== "" ||
    filtroNome !== "" ||
    filtroFuncao !== "" ||
    filtroTotal !== null ||
    filtroPresenca !== "todos" ||
    diasSelecionados.size > 0;

  function alternarFiltroPresenca(valor: "presentes" | "ausentes") {
    setFiltroPresenca((atual) => (atual === valor ? "todos" : valor));
  }

  function toggleDia(diaId: string) {
    setDiasSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(diaId)) novo.delete(diaId);
      else novo.add(diaId);
      return novo;
    });
  }

  function selecionarTodosDias() {
    setDiasSelecionados(new Set(diasOrdenados.map((d) => d.id)));
  }

  function limparDias() {
    setDiasSelecionados(new Set());
  }

  const rotuloFiltroDias =
    diasSelecionados.size === 0
      ? "Todos os dias"
      : `${diasSelecionados.size} dia${diasSelecionados.size === 1 ? "" : "s"}`;

  const classeFiltroDias =
    filtroPresenca === "ausentes" && diasSelecionados.size > 0
      ? "bg-vermelho text-white"
      : diasSelecionados.size > 0
        ? "filtro-chip-ativo"
        : "filtro-chip-inativo";

  if (!sessao) return null;
  if (!podeVer) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">Sem acesso a esta seção.</p>
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
  if (carregandoEdicao) return <p className="text-ardesia">Carregando...</p>;
  if (!edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem edição ativa</h3>
          <p className="text-ardesia">
            Marque uma edição como ativa para gerar o relatório de presença.
          </p>
          <Link
            to="/edicoes"
            className="btn btn-primario mt-4"
            aria-label="Abrir edições"
            title="Abrir edições"
          >
            <Icone nome="calendario" />
          </Link>
        </div>
      </div>
    );
  }

  const hoje = dataLocalISO(new Date());

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Operação</div>
          <h2 className="mt-1">Relatório de presença</h2>
          <p className="text-ardesia text-sm">
            {edicao.numero}ª edição ({edicao.ano}) · todas as pessoas alocadas,
            com o total de presenças e o quadro por dia de festa
          </p>
        </div>
      </header>

      <div className="tabs">
        <div className="tabs-lista">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "pessoas"}
            className={`aba ${aba === "pessoas" ? "aba-ativa" : ""}`}
            onClick={() => setAba("pessoas")}
          >
            Pessoas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "equipes-sem-presenca"}
            className={`aba ${aba === "equipes-sem-presenca" ? "aba-ativa" : ""}`}
            onClick={() => setAba("equipes-sem-presenca")}
          >
            Equipes sem presença
          </button>
        </div>

        {aba === "pessoas" && (
          <section className="space-y-6 tabs-painel">
            <div className="card">
        <div className="card-corpo space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ardesia">
              <button
                type="button"
                className={`filtro-chip ${filtroPresenca === "presentes" ? "filtro-chip-ativo" : "filtro-chip-inativo"}`}
                onClick={() => alternarFiltroPresenca("presentes")}
                aria-pressed={filtroPresenca === "presentes"}
                aria-label="Filtrar apenas quem esteve presente nos dias selecionados"
                title="Ver apenas quem esteve presente em pelo menos um dos dias do recorte (todos os dias, se nenhum for escolhido)"
              >
                <span
                  className={`inline-block w-3 h-3 rounded-sm ${filtroPresenca === "presentes" ? "bg-bianco" : "bg-verde"}`}
                  aria-hidden="true"
                />
                presente
              </button>
              <button
                type="button"
                className={`filtro-chip ${filtroPresenca === "ausentes" ? "bg-vermelho text-white" : "filtro-chip-inativo"}`}
                onClick={() => alternarFiltroPresenca("ausentes")}
                aria-pressed={filtroPresenca === "ausentes"}
                aria-label="Filtrar apenas quem faltou nos dias selecionados"
                title="Ver apenas quem faltou em todos os dias do recorte (todos os dias, se nenhum for escolhido)"
              >
                <span
                  className={`inline-block w-3 h-3 rounded-sm ${filtroPresenca === "ausentes" ? "bg-bianco" : "bg-vermelho"}`}
                  aria-hidden="true"
                />
                ausente
              </button>
              <span className="inline-flex items-center gap-1.5 px-2 py-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-pietra-clara border border-pietra" />
                data futura
              </span>
            </div>

            <div className="relative">
              <button
                type="button"
                className={`filtro-chip ${classeFiltroDias}`}
                onClick={() => setFiltroDiasAberto((a) => !a)}
                aria-haspopup="listbox"
                aria-expanded={filtroDiasAberto}
                aria-label="Filtrar por dias de festa"
                title="Filtrar por dias de festa"
              >
                <Icone nome="calendario" tamanho={16} />
                <span>{rotuloFiltroDias}</span>
                <Icone nome="seta-baixo" tamanho={14} />
              </button>

              {filtroDiasAberto && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setFiltroDiasAberto(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 mt-1 z-50 w-72 bg-bianco border border-pietra rounded-md shadow-suave">
                    <div className="max-h-64 overflow-y-auto py-1">
                      {diasOrdenados.map((dia) => {
                        const marcado = diasSelecionados.has(dia.id);
                        return (
                          <label
                            key={dia.id}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-pietra-clara/60"
                          >
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={marcado}
                              onChange={() => toggleDia(dia.id)}
                            />
                            <span className="font-mono">
                              {formatarData(dia.data)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-pietra-clara px-3 py-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-verde hover:underline"
                        onClick={selecionarTodosDias}
                        disabled={diasSelecionados.size === diasOrdenados.length}
                      >
                        Selecionar todos
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-vermelho-escuro hover:underline"
                        onClick={limparDias}
                        disabled={diasSelecionados.size === 0}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="filtro-equipe">
                Equipe
              </label>
              <input
                id="filtro-equipe"
                type="text"
                className="input"
                placeholder="Filtrar equipe..."
                aria-label="Filtrar por equipe"
                value={filtroEquipe}
                onChange={(e) => setFiltroEquipe(e.target.value)}
              />
            </div>
            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="filtro-nome">
                Nome ou crachá
              </label>
              <input
                id="filtro-nome"
                type="text"
                className="input"
                placeholder="Filtrar por nome ou crachá..."
                aria-label="Filtrar por nome ou crachá"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
              />
            </div>
            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="filtro-funcao">
                Função
              </label>
              <input
                id="filtro-funcao"
                type="text"
                className="input"
                placeholder="Filtrar por função..."
                aria-label="Filtrar por função"
                value={filtroFuncao}
                onChange={(e) => setFiltroFuncao(e.target.value)}
              />
            </div>
            <div className="input-grupo m-0">
              <label className="input-label" htmlFor="filtro-total">
                Total
              </label>
              <input
                id="filtro-total"
                type="text"
                inputMode="numeric"
                className="input text-center font-mono"
                placeholder="Todos"
                aria-label="Filtrar por total de presenças"
                value={filtroTotal === null ? "" : filtroTotal}
                onChange={(e) => {
                  const digitos = e.target.value.replace(/\D+/g, "");
                  setFiltroTotal(digitos === "" ? null : Number(digitos));
                }}
              />
            </div>
          </div>

          <p className="text-ardesia text-sm">
            Os chips presente e ausente consideram os dias selecionados no
            dropdown (sem seleção, valem todos os dias): presente mostra quem
            foi em pelo menos um dia do recorte; ausente, quem faltou em todos.
          </p>
        </div>
      </div>

      {erroPessoas && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erroPessoas}</div>
        </div>
      )}

      {!erroPessoas && diasOrdenados.length === 0 && (
        <div className="card">
          <div className="card-corpo">
            <p className="text-ardesia">
              Nenhum dia de festa cadastrado nesta edição.
            </p>
          </div>
        </div>
      )}
      
      <p className="text-ardesia text-sm text-right mb-4">
        {carregandoPessoas
          ? "Carregando..."
          : `${linhasFiltradas.length} de ${linhas.length} registros`}
      </p>

      {!erroPessoas && diasOrdenados.length > 0 && (
        <div className="card overflow-hidden">
            <div className="tabela-rolavel">
              <table className="tabela-larga">
                <thead className="bg-pietra-clara/60 text-left">
                  <tr>
                    <th className="px-4 py-2 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold hover:text-verde-escuro"
                        onClick={() => toggleOrdenacao("equipe")}
                        aria-label="Ordenar por equipe"
                        title="Ordenar por equipe"
                      >
                        Equipe
                        {colunaOrdenada === "equipe" && (
                          <Icone
                            nome={ordemAsc ? "topo" : "seta-baixo"}
                            tamanho={14}
                          />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-2 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold hover:text-verde-escuro"
                        onClick={() => toggleOrdenacao("nome")}
                        aria-label="Ordenar por nome"
                        title="Ordenar por nome"
                      >
                        Crachá · Nome
                        {colunaOrdenada === "nome" && (
                          <Icone
                            nome={ordemAsc ? "topo" : "seta-baixo"}
                            tamanho={14}
                          />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-2 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold hover:text-verde-escuro"
                        onClick={() => toggleOrdenacao("funcao")}
                        aria-label="Ordenar por função"
                        title="Ordenar por função"
                      >
                        Função
                        {colunaOrdenada === "funcao" && (
                          <Icone
                            nome={ordemAsc ? "topo" : "seta-baixo"}
                            tamanho={14}
                          />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-2 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold hover:text-verde-escuro"
                        onClick={() => toggleOrdenacao("total")}
                        aria-label="Ordenar por total de presenças"
                        title="Ordenar por total de presenças"
                      >
                        Total
                        {colunaOrdenada === "total" && (
                          <Icone
                            nome={ordemAsc ? "topo" : "seta-baixo"}
                            tamanho={14}
                          />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-2 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold hover:text-verde-escuro"
                        onClick={() => toggleOrdenacao("total")}
                        aria-label="Ordenar por número de dias presentes"
                        title="Ordenar por número de dias presentes"
                      >
                        Dias
                        {colunaOrdenada === "total" && (
                          <Icone
                            nome={ordemAsc ? "topo" : "seta-baixo"}
                            tamanho={14}
                          />
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-ardesia text-sm"
                      >
                        {filtrosAtivos
                          ? "Nenhum registro encontrado com os filtros atuais."
                          : "Nenhuma pessoa alocada nesta edição."}
                      </td>
                    </tr>
                  ) : (
                    linhasFiltradas.map((linha) => (
                      <tr
                        key={linha.pessoaId}
                        className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                      >
                        <td className="px-4 py-2 text-ardesia whitespace-nowrap truncate max-w-[12rem]">
                          {linha.equipeNome}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap truncate max-w-[22rem]">
                          <span className="font-mono text-ardesia">
                            #{linha.cracha}
                          </span>{" "}
                          <span className="font-semibold">
                            {linha.pessoaNome}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-ardesia">
                          {linha.funcao}
                        </td>
                        <td className="px-4 py-2 font-mono font-semibold">
                          {carregandoPresencas ? "—" : linha.total}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-0.5 whitespace-nowrap">
                            {diasOrdenados.map((dia, indice) => {
                              const presente = linha.diasPresentes.has(dia.id);
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
                                  title={`Dia ${indice + 1} · ${formatarData(dia.data)}`}
                                  className={`w-6 h-6 rounded-sm flex items-center justify-center font-mono text-xs font-semibold select-none ${classe}`}
                                >
                                  {indice + 1}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
        )}
          </section>
        )}

        {aba === "equipes-sem-presenca" && (
          <section className="space-y-6 tabs-painel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-ardesia text-sm">
                Equipes desta edição sem nenhuma presença registrada, agrupadas
                por dia de festa.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  onClick={exportarEquipesSemPresencaCsv}
                  disabled={totalEquipesSemPresenca === 0 || carregandoPresencas}
                  aria-label="Exportar CSV"
                  title="Exportar CSV"
                >
                  <Icone nome="baixar" />
                </button>
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  onClick={copiarEquipesSemPresenca}
                  disabled={totalEquipesSemPresenca === 0 || carregandoPresencas}
                  aria-label={copiado ? "Copiado!" : "Copiar TSV"}
                  title={copiado ? "Copiado!" : "Copiar TSV"}
                >
                  <Icone nome="copiar" />
                </button>
              </div>
            </div>

            <p className="text-ardesia text-sm text-right">
              {carregandoPresencas
                ? "Carregando..."
                : `${totalEquipesSemPresenca} ocorrência${
                    totalEquipesSemPresenca === 1 ? "" : "s"
                  } de equipe sem presença`}
            </p>

            {totalEquipesSemPresenca === 0 ? (
              <div className="card">
                <div className="card-corpo">
                  <p className="text-ardesia">
                    Todas as equipes têm presença registrada em todos os dias.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="tabela-rolavel">
                  <table className="tabela-larga">
                    <thead className="bg-pietra-clara/60 text-left">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Data</th>
                        <th className="px-4 py-2 font-semibold">Pasta</th>
                        <th className="px-4 py-2 font-semibold">
                          Nome da Equipe
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipesSemPresencaPorDia.map((dia, indice) => {
                        const cabecalho = (
                          <tr className="bg-pietra-clara/30">
                            <td
                              colSpan={3}
                              className="px-4 py-2 font-semibold"
                            >
                              Dia {indice + 1} · {formatarData(dia.data)}
                              <span className="ml-2 text-sm font-normal text-ardesia">
                                ({dia.equipes.length}{" "}
                                {dia.equipes.length === 1
                                  ? "equipe"
                                  : "equipes"}{" "}
                                sem presença)
                              </span>
                            </td>
                          </tr>
                        );
                        if (dia.equipes.length === 0) {
                          return (
                            <Fragment key={dia.diaId}>
                              {cabecalho}
                              <tr>
                                <td
                                  colSpan={3}
                                  className="px-4 py-4 text-center text-ardesia text-sm"
                                >
                                  Nenhuma equipe sem presença neste dia.
                                </td>
                              </tr>
                            </Fragment>
                          );
                        }
                        return (
                          <Fragment key={dia.diaId}>
                            {cabecalho}
                            {dia.equipes.map((equipe) => {
                              const setor = infoSetor(equipe.setor, setoresPorId);
                              return (
                                <tr
                                  key={equipe.id}
                                  className="border-t border-pietra-clara hover:brightness-90"
                                  style={{ backgroundColor: `${setor.cor}3D` }}
                                >
                                  <td className="px-4 py-2 font-mono whitespace-nowrap">
                                    {formatarData(dia.data)}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span
                                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: setor.cor }}
                                        aria-hidden
                                      />
                                      <span className="text-ardesia">
                                        {setor.rotulo}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 font-semibold">
                                    {equipe.nome}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
        </div>
      </div>
  );
}
