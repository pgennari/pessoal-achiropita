"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { db, assinarMudancas } from "@/lib/db";

function Conteudo() {
  const [versao, setVersao] = useState(0);
  useEffect(() => assinarMudancas(() => setVersao((v) => v + 1)), []);
  const eventos = db.auditoria();

  return (
    <>
      <PageHeader
        titulo="Auditoria"
        descricao="Log de eventos sensíveis (US-12-03)."
      />
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
                <tr key={ev.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-5 text-slate-600">
                    {new Date(ev.criadoEm).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 px-5">{ev.autor}</td>
                  <td className="py-3 px-5">{ev.acao.replace(/_/g, " ")}</td>
                  <td className="py-3 px-5 font-mono text-xs">{ev.alvo}</td>
                  <td className="py-3 px-5 text-slate-600">{ev.detalhes || "—"}</td>
                </tr>
              ))}
              {eventos.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Sem eventos registrados ainda.
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
