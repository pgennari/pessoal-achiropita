"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { db, assinarMudancas } from "@/lib/db";
import { formatarData, normalizar } from "@/lib/utils";

function Conteudo() {
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => assinarMudancas(() => setVersao((v) => v + 1)), []);

  const pessoas = db.pessoas();
  const edicaoAtiva = db.edicaoAtiva();
  const participacoesAtivas = edicaoAtiva
    ? db.participacoes({ edicaoId: edicaoAtiva.id })
    : [];
  const barracas = edicaoAtiva ? db.barracas(edicaoAtiva.id) : [];

  const lista = useMemo(() => {
    const termo = normalizar(busca);
    return pessoas
      .filter((p) => incluirInativos || p.ativo)
      .filter((p) => {
        if (!termo) return true;
        return (
          normalizar(p.nome).includes(termo) ||
          String(p.cracha).includes(termo) ||
          (p.cpf || "").includes(termo) ||
          normalizar(p.telefone).includes(termo)
        );
      })
      .slice(0, 50);
  }, [busca, incluirInativos, pessoas]);

  function barracaDe(pessoaId: string) {
    const part = participacoesAtivas.find((p) => p.pessoaId === pessoaId);
    if (!part) return null;
    const barraca = barracas.find((b) => b.id === part.barracaId);
    return barraca ? `${barraca.nome} · ${part.funcao}` : null;
  }

  return (
    <>
      <PageHeader
        titulo="Pessoas"
        descricao="Cadastro central da equipe da festa."
        acoes={
          <Link href="/pessoas/nova" className="btn-primary">
            + Nova pessoa
          </Link>
        }
      />

      <div className="card mb-4">
        <div className="card-body flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex-1">
            <input
              className="input"
              placeholder="Buscar por nome, crachá, CPF ou telefone…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={incluirInativos}
              onChange={(e) => setIncluirInativos(e.target.checked)}
            />
            incluir inativos
          </label>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-5">Crachá</th>
                <th className="py-3 px-5">Nome</th>
                <th className="py-3 px-5">Telefone</th>
                <th className="py-3 px-5">Edição corrente</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const local = barracaDe(p.id);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="py-3 px-5 font-mono text-slate-700">
                      {p.cracha}
                    </td>
                    <td className="py-3 px-5">
                      <Link
                        href={`/pessoas/${p.id}`}
                        className="font-medium text-slate-900 hover:text-achiropita-700"
                      >
                        {p.nome}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {formatarData(p.nascimento)}
                      </div>
                    </td>
                    <td className="py-3 px-5">{p.telefone}</td>
                    <td className="py-3 px-5">
                      {local || (
                        <span className="text-slate-400">não alocado</span>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      {!p.ativo && (
                        <span className="badge bg-slate-200 text-slate-700 mr-1">
                          inativo
                        </span>
                      )}
                      {p.dadosValidados ? (
                        <span className="badge bg-emerald-100 text-emerald-700">
                          validado
                        </span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-700">
                          pendente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Link
                        href={`/pessoas/${p.id}`}
                        className="text-achiropita-700 text-sm hover:underline"
                      >
                        abrir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Nenhuma pessoa encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Mostrando até 50 resultados. Refine a busca para encontrar mais
        rapidamente.
      </p>
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
