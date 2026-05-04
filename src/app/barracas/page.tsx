"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { PageHeader } from "@/components/PageHeader";
import { useEdicaoAtiva } from "@/hooks/useEdicoes";
import { useBarracas } from "@/hooks/useBarracas";
import { useParticipacoes } from "@/hooks/useParticipacoes";
import { useSessao, podeAdministrar } from "@/lib/auth";
import { criarBarraca } from "@/lib/mutations";
import { Setor } from "@/lib/types";
import { porcentagem } from "@/lib/utils";

function Conteudo() {
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState<Setor>("Alimentação");
  const [coord, setCoord] = useState(1);
  const [eqp, setEqp] = useState(10);
  const [apoio, setApoio] = useState(2);
  const [filtroSetor, setFiltroSetor] = useState<Setor | "Todos">("Todos");

  const { sessao } = useSessao();
  const podeAdm = podeAdministrar(sessao);
  const { data: edicao } = useEdicaoAtiva();
  const { data: barracas } = useBarracas(edicao?.id);
  const { data: participacoes } = useParticipacoes({ edicaoId: edicao?.id });

  const lista = barracas.filter(
    (b) => filtroSetor === "Todos" || b.setor === filtroSetor
  );

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    setSalvando(true);
    try {
      await criarBarraca({
        edicaoId: edicao.id,
        nome: nome.trim(),
        setor,
        vagas: { coordenador: coord, equipista: eqp, apoio },
      });
      setCriando(false);
      setNome("");
      setCoord(1);
      setEqp(10);
      setApoio(2);
    } finally {
      setSalvando(false);
    }
  }

  if (!edicao) {
    return (
      <>
        <PageHeader titulo="Barracas" />
        <p className="text-slate-500">
          Nenhuma edição ativa. Crie uma em Edições.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Barracas"
        descricao={`Edição ${edicao.numero}ª · ${edicao.ano}`}
        acoes={
          podeAdm && (
            <button
              className="btn-primary"
              onClick={() => setCriando((c) => !c)}
            >
              {criando ? "Cancelar" : "+ Nova barraca"}
            </button>
          )
        }
      />

      {criando && (
        <div className="card mb-4">
          <div className="card-body">
            <form
              onSubmit={criar}
              className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
            >
              <div className="md:col-span-2">
                <label className="label">Nome</label>
                <input
                  className="input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Setor</label>
                <select
                  className="input"
                  value={setor}
                  onChange={(e) => setSetor(e.target.value as Setor)}
                >
                  <option>Interna</option>
                  <option>Externa</option>
                  <option>Alimentação</option>
                </select>
              </div>
              <div>
                <label className="label">Coord.</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={coord}
                  onChange={(e) => setCoord(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Equipistas</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={eqp}
                  onChange={(e) => setEqp(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Apoio</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={apoio}
                  onChange={(e) => setApoio(Number(e.target.value))}
                />
              </div>
              <button disabled={salvando} className="btn-primary md:col-span-6">
                {salvando ? "Criando…" : "Criar barraca"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body flex gap-2 items-center">
          <span className="text-sm text-slate-600">Filtrar setor:</span>
          {(["Todos", "Interna", "Externa", "Alimentação"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFiltroSetor(s)}
              className={
                "px-3 py-1 rounded-full text-xs border " +
                (filtroSetor === s
                  ? "bg-achiropita-600 text-white border-achiropita-600"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100")
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lista.map((b) => {
          const aloc = participacoes.filter((p) => p.barracaId === b.id).length;
          const total =
            b.vagas.coordenador + b.vagas.equipista + b.vagas.apoio;
          const pct = porcentagem(aloc, total);
          const cor =
            pct >= 90
              ? "bg-emerald-500"
              : pct >= 60
              ? "bg-amber-500"
              : "bg-rose-500";
          return (
            <div key={b.id} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{b.nome}</h3>
                  <span className="badge bg-slate-100 text-slate-700">
                    {b.setor}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Vagas: {b.vagas.coordenador} coord. · {b.vagas.equipista} eqp.
                  · {b.vagas.apoio} apoio
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2 ${cor}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {aloc}/{total}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {lista.length === 0 && (
          <div className="text-slate-500 text-sm col-span-full">
            Nenhuma barraca neste filtro.
          </div>
        )}
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
