"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { PessoaForm } from "@/components/PessoaForm";
import { db, assinarMudancas } from "@/lib/db";
import { auth, podeEditarPessoa } from "@/lib/auth";
import { calcularIdade, formatarData } from "@/lib/utils";

function Conteudo() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [editando, setEditando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => assinarMudancas(() => setVersao((v) => v + 1)), []);

  const pessoa = id ? db.pessoa(id) : undefined;
  const sessao = auth.sessao();
  const podeEditar = podeEditarPessoa(sessao, id || "");

  const participacoes = useMemo(() => {
    if (!pessoa) return [];
    return db
      .participacoes({ pessoaId: pessoa.id })
      .sort((a, b) => {
        const ea = db.edicoes().find((x) => x.id === a.edicaoId);
        const eb = db.edicoes().find((x) => x.id === b.edicaoId);
        return (eb?.numero ?? 0) - (ea?.numero ?? 0);
      });
  }, [pessoa, versao]);

  if (!pessoa) {
    return (
      <div className="text-slate-500">
        Pessoa não encontrada.{" "}
        <Link href="/pessoas" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  const idade = calcularIdade(pessoa.nascimento);
  const totalEdicoes = participacoes.length;
  const comoCoordenador = participacoes.filter(
    (p) => p.funcao === "Coordenador"
  ).length;
  const barracasUnicas = new Set(participacoes.map((p) => p.barracaId)).size;

  function salvar(dados: Parameters<typeof handleSubmit>[0]) {
    handleSubmit(dados);
  }

  function handleSubmit(dados: {
    nome: string;
    nascimento: string;
    telefone: string;
    email?: string;
    cpf?: string;
    rg?: string;
    endereco?: string;
    bairro?: string;
    estadoCivil?: import("@/lib/types").EstadoCivil;
    cracha: number;
    ativo: boolean;
  }) {
    if (!sessao || !pessoa) return;
    db.atualizarPessoa(pessoa.id, dados, sessao.email);
    setEditando(false);
  }

  function alternarAtivo() {
    if (!sessao || !pessoa) return;
    db.atualizarPessoa(pessoa.id, { ativo: !pessoa.ativo }, sessao.email);
  }

  function alternarValidado() {
    if (!sessao || !pessoa) return;
    db.atualizarPessoa(
      pessoa.id,
      { dadosValidados: !pessoa.dadosValidados },
      sessao.email
    );
  }

  return (
    <>
      <PageHeader
        titulo={pessoa.nome}
        descricao={`Crachá ${pessoa.cracha} · ${
          idade !== null ? `${idade} anos` : "idade não informada"
        }`}
        acoes={
          podeEditar && !editando ? (
            <>
              <button onClick={() => setEditando(true)} className="btn-secondary">
                Editar
              </button>
              <button onClick={alternarAtivo} className="btn-secondary">
                {pessoa.ativo ? "Inativar" : "Reativar"}
              </button>
            </>
          ) : undefined
        }
      />

      {editando ? (
        <div className="card">
          <div className="card-body">
            <PessoaForm
              inicial={pessoa}
              onSubmit={salvar}
              onCancelar={() => setEditando(false)}
              textoSubmit="Salvar alterações"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Info label="Telefone" valor={pessoa.telefone} />
                <Info label="E-mail" valor={pessoa.email} />
                <Info label="CPF" valor={pessoa.cpf} />
                <Info label="RG" valor={pessoa.rg} />
                <Info label="Nascimento" valor={formatarData(pessoa.nascimento)} />
                <Info label="Estado civil" valor={pessoa.estadoCivil} />
                <Info label="Endereço" valor={pessoa.endereco} />
                <Info label="Bairro" valor={pessoa.bairro} />
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Histórico de edições</h2>
                  <div className="text-xs text-slate-500">
                    {totalEdicoes} edições · {comoCoordenador} como coordenador
                    · {barracasUnicas} barracas
                  </div>
                </div>
                {participacoes.length === 0 ? (
                  <p className="text-slate-500 text-sm">
                    Sem participações registradas.
                  </p>
                ) : (
                  <ol className="relative border-l-2 border-achiropita-100 ml-2">
                    {participacoes.map((p) => {
                      const ed = db.edicoes().find((e) => e.id === p.edicaoId);
                      const b = db
                        .barracas()
                        .find((bb) => bb.id === p.barracaId);
                      const destaque = p.funcao === "Coordenador";
                      return (
                        <li key={p.id} className="ml-6 mb-4">
                          <span
                            className={
                              "absolute -left-[7px] flex h-3 w-3 rounded-full " +
                              (destaque
                                ? "bg-achiropita-600"
                                : "bg-achiropita-200")
                            }
                          />
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-semibold">
                              {ed ? `${ed.numero}ª · ${ed.ano}` : "Edição"}
                            </span>
                            <span className="text-slate-600">
                              {b?.nome || "—"}
                            </span>
                            <span
                              className={
                                "badge " +
                                (destaque
                                  ? "bg-achiropita-100 text-achiropita-700"
                                  : "bg-slate-100 text-slate-700")
                              }
                            >
                              {p.funcao}
                            </span>
                            {b?.setor && (
                              <span className="badge bg-slate-100 text-slate-600">
                                {b.setor}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="card-body">
                <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-3">
                  Status
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Cadastro</span>
                    {pessoa.ativo ? (
                      <span className="badge bg-emerald-100 text-emerald-700">
                        ativo
                      </span>
                    ) : (
                      <span className="badge bg-slate-200 text-slate-700">
                        inativo
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Dados validados</span>
                    {pessoa.dadosValidados ? (
                      <span className="badge bg-emerald-100 text-emerald-700">
                        sim
                      </span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-700">
                        pendente
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Foto</span>
                    {pessoa.fotoUrl ? (
                      <span className="badge bg-emerald-100 text-emerald-700">
                        ok
                      </span>
                    ) : (
                      <span className="badge bg-rose-100 text-rose-700">
                        falta
                      </span>
                    )}
                  </div>
                </div>
                {podeEditar && (
                  <button
                    onClick={alternarValidado}
                    className="btn-secondary w-full mt-4 text-xs"
                  >
                    {pessoa.dadosValidados
                      ? "Marcar como não validado"
                      : "Marcar como validado"}
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-3">
                  Filhos
                </h2>
                {pessoa.filhos.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum filho cadastrado.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {pessoa.filhos.map((f) => (
                      <li key={f.id} className="flex justify-between">
                        <span>
                          {f.nome}{" "}
                          <span className="text-slate-500">
                            ({calcularIdade(f.nascimento)} anos)
                          </span>
                        </span>
                        {f.frequentaRecreacao && (
                          <span className="badge bg-achiropita-100 text-achiropita-700">
                            recreação
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Info({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-slate-900">{valor || "—"}</div>
    </div>
  );
}

export default function Pagina() {
  return (
    <AuthGuard>
      <Conteudo />
    </AuthGuard>
  );
}
