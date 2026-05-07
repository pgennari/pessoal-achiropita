import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useEdicoes,
  usePessoas,
  useTodasBarracas,
  useTodasParticipacoes,
} from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  FUNCOES,
  Funcao,
  Pessoa,
} from "../lib/tipos";
import { calcularIdade, normalizar } from "../lib/utilsDominio";

interface LinhaResultado {
  pessoa: Pessoa;
  edicoes: Set<string>;
  funcoes: Set<Funcao>;
  barracas: Set<string>; // por nome
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
  const { sessao } = useSessao();
  const { itens: pessoas } = usePessoas();
  const { itens: barracas } = useTodasBarracas();
  const { itens: edicoes } = useEdicoes();
  const { itens: participacoes, carregando } = useTodasParticipacoes();

  const [nomeBarraca, setNomeBarraca] = useState<string>("todas");
  const [funcao, setFuncao] = useState<Funcao | "todas">("todas");
  const [edicoesMin, setEdicoesMin] = useState<number>(1);
  const [idadeMin, setIdadeMin] = useState<string>("");
  const [idadeMax, setIdadeMax] = useState<string>("");

  // Lista distinta de nomes de barraca (across edições) para o select.
  const nomesBarracas = useMemo(() => {
    const set = new Set<string>();
    for (const b of barracas) set.add(b.nome.trim());
    return Array.from(set).sort((a, b) =>
      normalizar(a).localeCompare(normalizar(b))
    );
  }, [barracas]);

  const indiceBarracas = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    for (const b of barracas) m.set(b.id, { nome: b.nome.trim() });
    return m;
  }, [barracas]);

  const indicePessoas = useMemo(() => {
    const m = new Map<string, Pessoa>();
    for (const p of pessoas) m.set(p.id, p);
    return m;
  }, [pessoas]);

  const resultados = useMemo<LinhaResultado[]>(() => {
    const min = Number.isFinite(parseInt(idadeMin, 10))
      ? parseInt(idadeMin, 10)
      : null;
    const max = Number.isFinite(parseInt(idadeMax, 10))
      ? parseInt(idadeMax, 10)
      : null;

    const por = new Map<string, LinhaResultado>();
    for (const p of participacoes) {
      if (funcao !== "todas" && p.funcao !== funcao) continue;
      if (nomeBarraca !== "todas") {
        const nome = indiceBarracas.get(p.barracaId)?.nome;
        if (nome !== nomeBarraca) continue;
      }
      const pessoa = indicePessoas.get(p.pessoaId);
      if (!pessoa) continue;

      const idade = calcularIdade(pessoa.nascimento);
      if (min !== null && (idade === null || idade < min)) continue;
      if (max !== null && (idade === null || idade > max)) continue;

      let linha = por.get(pessoa.id);
      if (!linha) {
        linha = {
          pessoa,
          edicoes: new Set(),
          funcoes: new Set(),
          barracas: new Set(),
        };
        por.set(pessoa.id, linha);
      }
      linha.edicoes.add(p.edicaoId);
      linha.funcoes.add(p.funcao);
      const nome = indiceBarracas.get(p.barracaId)?.nome;
      if (nome) linha.barracas.add(nome);
    }

    return Array.from(por.values())
      .filter((l) => l.edicoes.size >= edicoesMin)
      .sort((a, b) => {
        if (b.edicoes.size !== a.edicoes.size)
          return b.edicoes.size - a.edicoes.size;
        return a.pessoa.nome.localeCompare(b.pessoa.nome);
      });
  }, [
    participacoes,
    funcao,
    nomeBarraca,
    edicoesMin,
    idadeMin,
    idadeMax,
    indiceBarracas,
    indicePessoas,
  ]);

  if (!sessao) return null;
  const podeVer = sessao.perfil === "ADM" || sessao.perfil === "ORG";
  if (!podeVer) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização podem consultar o histórico.
          </p>
          <Link to="/" className="btn btn-secundario mt-4">
            Voltar
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
      "barracas",
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
        Array.from(r.barracas).join("|"),
      ]
        .map(escaparCsv)
        .join(",");
    });
    const csv = [header.join(","), ...linhas].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    dispararCsv(`historico-${stamp}.csv`, csv);
  }

  const totalEdicoes = edicoes.length;

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Análise</div>
        <h2 className="mt-1">Histórico de participação</h2>
        <p className="text-ardesia text-sm">
          Quem já passou por uma barraca ou função, em quantas edições e em que
          faixa etária.
        </p>
      </header>

      <div className="card">
        <div className="card-corpo grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="input-grupo m-0">
            <label className="input-label" htmlFor="barraca">
              Barraca
            </label>
            <select
              id="barraca"
              className="input"
              value={nomeBarraca}
              onChange={(e) => setNomeBarraca(e.target.value)}
            >
              <option value="todas">Todas as barracas</option>
              {nomesBarracas.map((n) => (
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
              min={1}
              max={totalEdicoes || 99}
              className="input"
              value={edicoesMin}
              onChange={(e) =>
                setEdicoesMin(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
            />
          </div>

          <div className="input-grupo m-0">
            <label className="input-label">Faixa etária</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={120}
                placeholder="mín"
                className="input"
                value={idadeMin}
                onChange={(e) => setIdadeMin(e.target.value)}
              />
              <input
                type="number"
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
        >
          Exportar CSV
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-pietra-clara/60 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold w-20">Crachá</th>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold w-20 text-right">Idade</th>
              <th className="px-4 py-3 font-semibold w-24 text-right">Edições</th>
              <th className="px-4 py-3 font-semibold">Funções</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">
                Barracas
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
                  className="border-t border-pietra-clara hover:bg-pietra-clara/40"
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
                    {Array.from(r.barracas).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
