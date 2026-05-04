"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { useEdicaoAtiva } from "@/hooks/useEdicoes";
import { useTurmas } from "@/hooks/useTurmas";
import { useParticipacoes } from "@/hooks/useParticipacoes";
import { useBarracas } from "@/hooks/useBarracas";
import { usePessoas } from "@/hooks/usePessoas";
import { useSessao, podeAdministrar } from "@/lib/auth";
import {
  chamarGerarLinkValidacao,
  criarTurma,
  marcarFormacao,
} from "@/lib/mutations";
import { formatarData } from "@/lib/utils";

function Conteudo() {
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [local, setLocal] = useState("");
  const [instrutor, setInstrutor] = useState("");
  const [capacidade, setCapacidade] = useState(50);

  const { sessao } = useSessao();
  const podeAdm = podeAdministrar(sessao);
  const { data: edicao } = useEdicaoAtiva();
  const { data: turmas } = useTurmas(edicao?.id);
  const { data: participacoes } = useParticipacoes({ edicaoId: edicao?.id });
  const { data: barracas } = useBarracas(edicao?.id);
  const { data: pessoas } = usePessoas({ incluirInativos: true });

  const semFormacao = participacoes.filter((p) => !p.formacaoFeita);
  const validacaoPendente = participacoes
    .filter((p) => p.formacaoFeita)
    .filter((p) => {
      const pessoa = pessoas.find((pp) => pp.id === p.pessoaId);
      return pessoa && !pessoa.dadosValidados;
    });

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    setSalvando(true);
    try {
      await criarTurma({
        edicaoId: edicao.id,
        data,
        horario,
        local,
        instrutor,
        capacidade,
      });
      setCriando(false);
      setData("");
      setHorario("");
      setLocal("");
      setInstrutor("");
      setCapacidade(50);
    } finally {
      setSalvando(false);
    }
  }

  async function marcar(participacaoId: string) {
    await marcarFormacao(participacaoId);
  }

  async function gerarLink(turmaId: string) {
    try {
      const expira = new Date();
      expira.setDate(expira.getDate() + 30);
      const r = await chamarGerarLinkValidacao({
        turmaId,
        expiraEm: expira.toISOString(),
      });
      await navigator.clipboard.writeText(r.url);
      alert(`Link copiado para a área de transferência:\n${r.url}`);
    } catch (e: unknown) {
      alert(
        "Não foi possível gerar o link. Verifique se as Cloud Functions estão implantadas."
      );
    }
  }

  if (!edicao) {
    return (
      <>
        <PageHeader titulo="Formação" />
        <p className="text-slate-500">Nenhuma edição ativa.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Formação"
        descricao={`Edição ${edicao.numero}ª · ${edicao.ano}`}
        acoes={
          podeAdm && (
            <button
              className="btn-primary"
              onClick={() => setCriando((c) => !c)}
            >
              {criando ? "Cancelar" : "+ Nova turma"}
            </button>
          )
        }
      />

      {criando && (
        <div className="card mb-4">
          <div className="card-body">
            <form
              onSubmit={criar}
              className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="label">Data</label>
                <input
                  type="date"
                  className="input"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Horário</label>
                <input
                  type="time"
                  className="input"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Local</label>
                <input
                  className="input"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Instrutor</label>
                <input
                  className="input"
                  value={instrutor}
                  onChange={(e) => setInstrutor(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Capacidade</label>
                <input
                  type="number"
                  className="input"
                  value={capacidade}
                  onChange={(e) => setCapacidade(Number(e.target.value))}
                />
              </div>
              <button disabled={salvando} className="btn-primary md:col-span-5">
                {salvando ? "Criando…" : "Criar turma"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-3">Turmas agendadas</h2>
            {turmas.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma turma cadastrada.
              </p>
            ) : (
              <ul className="space-y-3">
                {turmas.map((t) => (
                  <li
                    key={t.id}
                    className="border border-slate-100 rounded-md p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {formatarData(t.data)} · {t.horario}
                      </span>
                      <span className="badge bg-slate-100 text-slate-700">
                        {t.capacidade} vagas
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {t.local} — instrutor: {t.instrutor}
                    </div>
                    {podeAdm && (
                      <button
                        className="btn-secondary mt-2 text-xs"
                        onClick={() => gerarLink(t.id)}
                      >
                        Gerar link de validação
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-1">
              Pendências (US-06-04)
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Substitui as abas “FALTA FORMAÇÃO” e “DADOS NÃO VALIDADOS” da
              planilha.
            </p>
            <h3 className="text-sm font-medium text-slate-700 mt-2">
              Sem formação ({semFormacao.length})
            </h3>
            <ul className="mt-2 space-y-2">
              {semFormacao.length === 0 && (
                <li className="text-xs text-slate-500">Nenhuma pendência.</li>
              )}
              {semFormacao.map((p) => {
                const pessoa = pessoas.find((pp) => pp.id === p.pessoaId);
                const barraca = barracas.find((b) => b.id === p.barracaId);
                return (
                  <li
                    key={p.id}
                    className="text-sm flex items-center justify-between"
                  >
                    <div>
                      <Link
                        href={`/pessoas/${p.pessoaId}`}
                        className="font-medium hover:text-achiropita-700"
                      >
                        {pessoa?.nome}
                      </Link>
                      <span className="text-xs text-slate-500 ml-2">
                        {barraca?.nome}
                      </span>
                    </div>
                    {podeAdm && (
                      <button
                        onClick={() => marcar(p.id)}
                        className="btn-secondary text-xs py-0.5 px-2"
                      >
                        Marcar presença
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            <h3 className="text-sm font-medium text-slate-700 mt-5">
              Formação feita, dados não validados ({validacaoPendente.length})
            </h3>
            <ul className="mt-2 space-y-1">
              {validacaoPendente.length === 0 && (
                <li className="text-xs text-slate-500">Nenhuma pendência.</li>
              )}
              {validacaoPendente.map((p) => {
                const pessoa = pessoas.find((pp) => pp.id === p.pessoaId);
                return (
                  <li
                    key={p.id}
                    className="text-sm text-slate-700 flex items-center justify-between"
                  >
                    <Link
                      href={`/pessoas/${p.pessoaId}`}
                      className="hover:text-achiropita-700"
                    >
                      {pessoa?.nome}
                    </Link>
                    <span className="text-xs text-amber-700">pendente</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Pagina() {
  return (
    <AuthGuard>
      <Conteudo />
    </AuthGuard>
  );
}
