"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { db, assinarMudancas } from "@/lib/db";
import { auth } from "@/lib/auth";
import { formatarData, normalizar, porcentagem } from "@/lib/utils";

function Conteudo() {
  const [versao, setVersao] = useState(0);
  const [busca, setBusca] = useState("");

  useEffect(() => assinarMudancas(() => setVersao((v) => v + 1)), []);

  const sessao = auth.sessao();
  const edicao = db.edicaoAtiva();
  const participacoes = edicao
    ? db.participacoes({ edicaoId: edicao.id })
    : [];
  const barracas = edicao ? db.barracas(edicao.id) : [];

  const lista = useMemo(() => {
    const termo = normalizar(busca);
    return participacoes.filter((p) => {
      if (!termo) return true;
      const pessoa = db.pessoa(p.pessoaId);
      if (!pessoa) return false;
      return (
        normalizar(pessoa.nome).includes(termo) ||
        String(pessoa.cracha).includes(termo)
      );
    });
  }, [busca, participacoes]);

  function entregar(id: string) {
    if (!sessao) return;
    db.marcarCrachaEntregue(id, sessao.email);
  }

  if (!edicao) {
    return (
      <>
        <PageHeader titulo="Entrega de crachás" />
        <p className="text-slate-500">Nenhuma edição ativa.</p>
      </>
    );
  }

  const totais = barracas.map((b) => {
    const desta = participacoes.filter((p) => p.barracaId === b.id);
    const ent = desta.filter((p) => p.crachaEntregue).length;
    return { barraca: b, total: desta.length, entregues: ent };
  });

  return (
    <>
      <PageHeader
        titulo="Entrega de crachás"
        descricao="Controle de entrega dos crachás produzidos externamente (US-07-02)."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {totais.map((t) => (
          <div key={t.barraca.id} className="card">
            <div className="card-body">
              <div className="text-sm font-semibold">{t.barraca.nome}</div>
              <div className="mt-1 text-xs text-slate-500">
                {t.entregues} de {t.total} entregues
              </div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-emerald-500"
                  style={{
                    width: `${porcentagem(t.entregues, t.total)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          <input
            className="input mb-3"
            placeholder="Buscar pessoa pelo nome ou número do crachá…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-2">Crachá</th>
                  <th className="py-3 px-2">Pessoa</th>
                  <th className="py-3 px-2">Barraca</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const pessoa = db.pessoa(p.pessoaId);
                  const barraca = barracas.find((b) => b.id === p.barracaId);
                  if (!pessoa) return null;
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 px-2 font-mono text-slate-700">
                        {pessoa.cracha}
                      </td>
                      <td className="py-3 px-2">
                        <Link
                          href={`/pessoas/${pessoa.id}`}
                          className="font-medium hover:text-achiropita-700"
                        >
                          {pessoa.nome}
                        </Link>
                      </td>
                      <td className="py-3 px-2 text-slate-600">
                        {barraca?.nome}
                      </td>
                      <td className="py-3 px-2">
                        {p.crachaEntregue ? (
                          <span className="badge bg-emerald-100 text-emerald-700">
                            entregue {formatarData(p.dataEntregaCracha)}
                          </span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-700">
                            pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {!p.crachaEntregue && (
                          <button
                            onClick={() => entregar(p.id)}
                            className="btn-primary text-xs py-1 px-3"
                          >
                            Marcar entregue
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Nenhum resultado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
