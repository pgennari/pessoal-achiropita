"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { useEdicoes } from "@/hooks/useEdicoes";
import { useSessao, podeAdministrar } from "@/lib/auth";
import { ativarEdicao, criarEdicao } from "@/lib/mutations";
import { formatarData } from "@/lib/utils";

function Conteudo() {
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [numero, setNumero] = useState("");
  const [ano, setAno] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const { sessao } = useSessao();
  const podeAdm = podeAdministrar(sessao);
  const { data: edicoes } = useEdicoes();

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await criarEdicao({
        numero: Number(numero),
        ano: Number(ano),
        inicio,
        fim,
        status: "planejamento",
      });
      setCriando(false);
      setNumero("");
      setAno("");
      setInicio("");
      setFim("");
    } finally {
      setSalvando(false);
    }
  }

  async function ativar(id: string) {
    await ativarEdicao(id);
  }

  return (
    <>
      <PageHeader
        titulo="Edições da festa"
        descricao="Apenas uma edição pode estar ativa por vez."
        acoes={
          podeAdm && (
            <button
              className="btn-primary"
              onClick={() => setCriando((c) => !c)}
            >
              {criando ? "Cancelar" : "+ Nova edição"}
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
                <label className="label">Número</label>
                <input
                  type="number"
                  className="input"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Ano</label>
                <input
                  type="number"
                  className="input"
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Início</label>
                <input
                  type="date"
                  className="input"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Fim</label>
                <input
                  type="date"
                  className="input"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  required
                />
              </div>
              <button disabled={salvando} className="btn-primary">
                {salvando ? "Criando…" : "Criar"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-5">Edição</th>
                <th className="py-3 px-5">Período</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {edicoes.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-3 px-5 font-medium">
                    {e.numero}ª · {e.ano}
                  </td>
                  <td className="py-3 px-5">
                    {formatarData(e.inicio)} – {formatarData(e.fim)}
                  </td>
                  <td className="py-3 px-5">
                    {e.status === "ativa" && (
                      <span className="badge bg-emerald-100 text-emerald-700">
                        ativa
                      </span>
                    )}
                    {e.status === "planejamento" && (
                      <span className="badge bg-amber-100 text-amber-700">
                        planejamento
                      </span>
                    )}
                    {e.status === "encerrada" && (
                      <span className="badge bg-slate-200 text-slate-700">
                        encerrada
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right">
                    {podeAdm && e.status !== "ativa" && (
                      <button
                        onClick={() => ativar(e.id)}
                        className="btn-secondary text-xs"
                      >
                        Definir como ativa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
