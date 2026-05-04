"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { useAuditoria } from "@/hooks/useAuditoria";

function Conteudo() {
  const { data: eventos, loading, error } = useAuditoria(200);

  return (
    <>
      <PageHeader
        titulo="Auditoria"
        descricao="Log de eventos sensíveis (US-12-03)."
      />
      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Acesso negado. Apenas administradores podem visualizar.
        </div>
      )}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-5">Quando</th>
                <th className="py-3 px-5">Autor</th>
                <th className="py-3 px-5">Ação</th>
                <th className="py-3 px-5">Alvo</th>
                <th className="py-3 px-5">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-3 px-5 text-slate-600">
                    {new Date(ev.criadoEm).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 px-5">{ev.autor}</td>
                  <td className="py-3 px-5">{ev.acao.replace(/_/g, " ")}</td>
                  <td className="py-3 px-5 font-mono text-xs">{ev.alvo}</td>
                  <td className="py-3 px-5 text-slate-600">
                    {ev.detalhes || "—"}
                  </td>
                </tr>
              ))}
              {eventos.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-slate-500"
                  >
                    {loading ? "Carregando…" : "Sem eventos registrados ainda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
