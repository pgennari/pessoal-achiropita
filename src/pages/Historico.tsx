import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useEdicoes,
  usePessoas,
  useTodasEquipes,
  useTodasParticipacoes,
  useTodosHistoricosParticipacao,
} from "../lib/hooks";
import { useSessao, podeAdministrar } from "../lib/sessao";
import { Icone } from "../components/Icone";
import {
  FUNCOES,
  Funcao,
  Pessoa,
} from "../lib/tipos";
import { calcularIdade, normalizar } from "../lib/utilsDominio";

interface LinhaResultado {
  pessoa: Pessoa;
  edicoes: Set<number>; // por número da edição (unifica atual + histórico)
  funcoes: Set<Funcao>;
  equipes: Set<string>; // por nome
}

function dispararCsv(nome: string, conteudo: string) {
  const blob = new Blob([`﻿${conteudo}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escaparCsv(valor: string | number): string {
  const s = String(valor ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function Historico() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens: pessoas } = usePessoas();
  const { itens: equipes } = useTodasEquipes();
  const { itens: edicoes } = useEdicoes();
  const { itens: participacoes, carregando: carregandoParts } =
    useTodasParticipacoes();
  const { itens: historicos, carregando: carregandoHist } =
    useTodosHistoricosParticipacao();
  const carregando = carregandoParts || carregandoHist;

  const [nomeEquipe, setNomeEquipe] = useState<string>("todas");
  const [funcao, setFuncao] = useState<Funcao | "todas">("todas");
  const [edicoesMin, setEdicoesMin] = useState<number | undefined>(1);
  const [idadeMin, setIdadeMin] = useState<string>("");
  const [idadeMax, setIdadeMax] = useState<string>("");

  const indiceEquipes = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    for (const e of equipes) m.set(e.id, { nome: e.nome.trim() });
    return m;
  }, [equipes]);

  const indiceEdicoes = useMemo(() => {
    const m = new Map<string, { numero: number }>();
    for (const e of edicoes) m.set(e.id, { numero: e.numero });
    return m;
  }, [edicoes]);

  const indicePessoas = useMemo(() => {
    const m = new Map<string, Pessoa>();
    for (const p of pessoas) m.set(p.id, p);
    return m;
  }, [pessoas]);

  // Lista distinta de nomes de equipe (das edições atuais + histórico).
  const nomesEquipes = useMemo(() => {
    const set = new Set<string>();
    for (const e of equipes) set.add(e.nome.trim());
    for (const h of historicos) {
      const nome = h.equipeNome.trim();
      if (nome) set.add(nome);
    }
    return Array.from(set).sort((a, b) =>
      normalizar(a).localeCompare(normalizar(b))
    );
  }, [equipes, historicos]);

  const resultados = useMemo<LinhaResultado[]>(() => {
    const min = Number.isFinite(parseInt(idadeMin, 10))
      ? parseInt(idadeMin, 10)
      : null;
    const max = Number.isFinite(parseInt(idadeMax, 10))
      ? parseInt(idadeMax, 10)
      : null;

    const por = new Map<string, LinhaResultado>();

    function obterLinha(pessoa: Pessoa): LinhaResultado | null {
      const idade = calcularIdade(pessoa.nascimento);
      if (min !== null && (idade === null || idade < min)) return null;
      if (max !== null && (idade === null || idade > max)) return null;
      let linha = por.get(pessoa.id);
      if (!linha) {
        linha = {
          pessoa,
          edicoes: new Set(),
          funcoes: new Set(),
          equipes: new Set(),
        };
        por.set(pessoa.id, linha);
      }
      return linha;
    }

    for (const p of participacoes) {
      if (funcao !== "todas" && p.funcao !== funcao) continue;
      const nomeEq = indiceEquipes.get(p.equipeId)?.nome;
      if (nomeEquipe !== "todas" && nomeEq !== nomeEquipe) continue;
      const pessoa = indicePessoas.get(p.pessoaId);
      if (!pessoa) continue;
      const linha = obterLinha(pessoa);
      if (!linha) continue;
      const numero = indiceEdicoes.get(p.edicaoId)?.numero;
      if (numero !== undefined) linha.edicoes.add(numero);
      linha.funcoes.add(p.funcao);
      if (nomeEq) linha.equipes.add(nomeEq);
    }

    for (const h of historicos) {
      if (funcao !== "todas" && h.funcao !== funcao) continue;
      const nomeEq = h.equipeNome.trim();
      if (nomeEquipe !== "todas" && nomeEq !== nomeEquipe) continue;
      const pessoa = indicePessoas.get(h.pessoaId);
      if (!pessoa) continue;
      const linha = obterLinha(pessoa);
      if (!linha) continue;
      linha.edicoes.add(h.edicaoNumero);
      if (h.funcao) linha.funcoes.add(h.funcao);
      if (nomeEq) linha.equipes.add(nomeEq);
    }

    const minEdicoes = edicoesMin ?? 1;
    return Array.from(por.values())
      .filter((l) => l.edicoes.size >= minEdicoes)
      .sort((a, b) => {
        if (b.edicoes.size !== a.edicoes.size)
          return b.edicoes.size - a.edicoes.size;
        return a.pessoa.nome.localeCompare(b.pessoa.nome);
      });
  }, [
    participacoes,
    historicos,
    funcao,
    nomeEquipe,
    edicoesMin,
    idadeMin,
    idadeMax,
    indiceEquipes,
    indiceEdicoes,
    indicePessoas,
  ]);

  // Cap do input "edições mínimas": maior número entre edições conhecidas e
  // a maior contagem de edições por pessoa nos resultados atuais.
  const totalEdicoes = useMemo(() => {
    let max = edicoes.length;
    for (const r of resultados) {
      if (r.edicoes.size > max) max = r.edicoes.size;
    }
    return max;
  }, [edicoes, resultados]);

  if (!sessao) return null;
  const podeVer = podeAdministrar(sessao);
  if (!podeVer) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização podem consultar o histórico.
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

  function exportarCsv() {
    const header = [
      "cracha",
      "nome",
      "idade",
      "telefone",
      "email",
      "edicoes",
      "funcoes",
      "equipes",
    ];
    const linhas = resultados.map((r) => {
      const idade = calcularIdade(r.pessoa.nascimento);
      return [
        r.pessoa.cracha,
        r.pessoa.nome,
        idade ?? "",
        r.pessoa.telefone,
        r.pessoa.email ?? "",
        r.edicoes.size,
        Array.from(r.funcoes).join("|"),
        Array.from(r.equipes).join("|"),
      ]
        .map(escaparCsv)
        .join(",");
    });
    const csv = [header.join(","), ...linhas].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    dispararCsv(`historico-${stamp}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Análise</div>
        <h2 className="mt-1">Histórico de participação</h2>
        <p className="text-ardesia text-sm">
          Quem já passou por uma equipe ou função, em quantas edições e em que
          faixa etária.
        </p>
      </header>

      <div className="card">
        <div className="card-corpo grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="input-grupo m-0">
            <label className="input-label" htmlFor="equipe">
              Equipe
            </label>
            <select
              id="equipe"
              className="input"
              value={nomeEquipe}
              onChange={(e) => setNomeEquipe(e.target.value)}
            >
              <option value="todas">Todas as equipes</option>
              {nomesEquipes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="input-grupo m-0">
            <label className="input-label" htmlFor="funcao">
              Função
            </label>
            <select
              id="funcao"
              className="input"
              value={funcao}
              onChange={(e) => setFuncao(e.target.value as Funcao | "todas")}
            >
              <option value="todas">Todas as funções</option>
              {FUNCOES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="input-grupo m-0">
            <label className="input-label" htmlFor="edicoesMin">
              Edições mínimas
            </label>
            <input
              id="edicoesMin"
              type="number"
              inputMode="numeric"
              min={1}
              max={totalEdicoes || 99}
              className="input"
              value={edicoesMin ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setEdicoesMin(v === "" ? undefined : parseInt(v, 10));
              }}
            />
          </div>

          <div className="input-grupo m-0">
            <label className="input-label">Faixa etária</label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                placeholder="mín"
                className="input"
                value={idadeMin}
                onChange={(e) => setIdadeMin(e.target.value)}
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                placeholder="máx"
                className="input"
                value={idadeMax}
                onChange={(e) => setIdadeMax(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ardesia text-sm">
          {carregando
            ? "Carregando..."
            : `${resultados.length} pessoa(s) com este perfil`}
        </p>
        <button
          type="button"
          className="btn btn-secundario btn-pequeno"
          onClick={exportarCsv}
          disabled={resultados.length === 0}
          aria-label="Exportar CSV"
          title="Exportar CSV"
        >
          <Icone nome="baixar" />
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="tabela-rolavel"><table className="tabela-larga">
          <thead className="bg-pietra-clara/60 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold w-20">Crachá</th>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold w-20 text-right">Idade</th>
              <th className="px-4 py-3 font-semibold w-24 text-right">Edições</th>
              <th className="px-4 py-3 font-semibold">Funções</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">
                Equipes
              </th>
            </tr>
          </thead>
          <tbody>
            {!carregando && resultados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ardesia">
                  Nenhuma pessoa combina com os filtros.
                </td>
              </tr>
            )}
            {resultados.map((r) => {
              const idade = calcularIdade(r.pessoa.nascimento);
              return (
                <tr
                  key={r.pessoa.id}
                  className="border-t border-pietra-clara hover:bg-pietra-clara/40 cursor-pointer"
                  onClick={() => navigate(`/pessoas/${r.pessoa.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-ardesia">
                    #{r.pessoa.cracha}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/pessoas/${r.pessoa.id}`}
                      className="font-semibold text-carbone hover:text-verde"
                    >
                      {r.pessoa.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-ardesia">
                    {idade ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.edicoes.size}
                  </td>
                  <td className="px-4 py-3 text-ardesia">
                    {Array.from(r.funcoes).join(", ")}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ardesia">
                    {Array.from(r.equipes).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
