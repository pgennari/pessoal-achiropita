"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { useEdicaoAtiva } from "@/hooks/useEdicoes";
import { useBarracas } from "@/hooks/useBarracas";
import { useParticipacoes } from "@/hooks/useParticipacoes";
import { usePessoas } from "@/hooks/usePessoas";
import { useSessao, podeAdministrar } from "@/lib/auth";
import {
  alocar as alocarMutation,
  moverParticipacao,
  removerParticipacao,
} from "@/lib/mutations";
import { Funcao } from "@/lib/types";
import { normalizar } from "@/lib/utils";

function Conteudo() {
  const [busca, setBusca] = useState("");
  const [barracaId, setBarracaId] = useState("");
  const [funcao, setFuncao] = useState<Funcao>("Equipista");
  const [mensagem, setMensagem] = useState<string | null>(null);

  const { sessao } = useSessao();
  const podeAdm = podeAdministrar(sessao);
  const { data: edicao } = useEdicaoAtiva();
  const { data: barracas } = useBarracas(edicao?.id);
  const { data: participacoes } = useParticipacoes({ edicaoId: edicao?.id });
  const { data: todasPessoas } = usePessoas();
  const pessoas = todasPessoas;

  const alocadosIds = useMemo(
    () => new Set(participacoes.map((p) => p.pessoaId)),
    [participacoes]
  );

  const naoAlocados = useMemo(() => {
    const termo = normalizar(busca);
    return pessoas
      .filter((p) => !alocadosIds.has(p.id))
      .filter(
        (p) =>
          !termo ||
          normalizar(p.nome).includes(termo) ||
          String(p.cracha).includes(termo)
      )
      .slice(0, 30);
  }, [busca, pessoas, alocadosIds]);

  async function alocar(pessoaId: string) {
    if (!edicao || !barracaId) {
      setMensagem("Selecione uma barraca para alocar.");
      return;
    }
    const r = await alocarMutation({
      pessoaId,
      edicaoId: edicao.id,
      barracaId,
      funcao,
      formacaoFeita: false,
      crachaEntregue: false,
    });
    setMensagem(r.ok ? null : r.erro);
  }

  async function remover(participacaoId: string) {
    await removerParticipacao(participacaoId);
  }

  async function moverPara(participacaoId: string, novaBarracaId: string) {
    await moverParticipacao(participacaoId, novaBarracaId);
  }

  if (!edicao) {
    return (
      <>
        <PageHeader titulo="Alocação" />
        <p className="text-slate-500">Nenhuma edição ativa.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Alocação na escala"
        descricao={`Edição ${edicao.numero}ª · ${edicao.ano} — atribua pessoas a barracas e funções.`}
      />

      {mensagem && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {mensagem}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-3">Disponíveis</h2>
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Buscar por nome ou crachá…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {podeAdm && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    className="input"
                    value={barracaId}
                    onChange={(e) => setBarracaId(e.target.value)}
                  >
                    <option value="">Selecione a barraca…</option>
                    {barracas.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome} · {b.setor}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value as Funcao)}
                  >
                    <option>Coordenador</option>
                    <option>Equipista</option>
                    <option>Apoio</option>
                  </select>
                </div>
              )}
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {naoAlocados.map((p) => (
                <li
                  key={p.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div>
                    <Link
                      href={`/pessoas/${p.id}`}
                      className="font-medium hover:text-achiropita-700"
                    >
                      {p.nome}
                    </Link>
                    <div className="text-xs text-slate-500">
                      Crachá {p.cracha}
                      {!p.dadosValidados && " · validação pendente"}
                    </div>
                  </div>
                  {podeAdm && (
                    <button
                      onClick={() => alocar(p.id)}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      Alocar
                    </button>
                  )}
                </li>
              ))}
              {naoAlocados.length === 0 && (
                <li className="py-6 text-center text-slate-500 text-sm">
                  Ninguém disponível.
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-3">Escala atual</h2>
            <div className="space-y-4">
              {barracas.map((b) => {
                const desta = participacoes.filter((p) => p.barracaId === b.id);
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-800 mb-2">
                      <span>{b.nome}</span>
                      <span className="text-xs font-normal text-slate-500">
                        {desta.length} alocado(s)
                      </span>
                    </div>
                    {desta.length === 0 ? (
                      <p className="text-xs text-slate-500 ml-1 mb-3">
                        Nenhum alocado ainda.
                      </p>
                    ) : (
                      <ul className="space-y-1 mb-3">
                        {desta.map((p) => {
                          const pessoa = pessoas.find(
                            (pp) => pp.id === p.pessoaId
                          );
                          return (
                            <li
                              key={p.id}
                              className="text-sm bg-slate-50 rounded-md px-3 py-2 flex items-center justify-between gap-2"
                            >
                              <div>
                                <Link
                                  href={`/pessoas/${p.pessoaId}`}
                                  className="font-medium hover:text-achiropita-700"
                                >
                                  {pessoa?.nome || "—"}
                                </Link>
                                <span className="ml-2 badge bg-slate-200 text-slate-700">
                                  {p.funcao}
                                </span>
                              </div>
                              {podeAdm && (
                                <div className="flex items-center gap-1">
                                  <select
                                    onChange={(e) =>
                                      moverPara(p.id, e.target.value)
                                    }
                                    value={b.id}
                                    className="text-xs border border-slate-200 rounded px-1 py-1"
                                  >
                                    {barracas.map((bb) => (
                                      <option key={bb.id} value={bb.id}>
                                        {bb.nome}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => remover(p.id)}
                                    className="text-xs text-rose-600 hover:underline"
                                  >
                                    remover
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
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
