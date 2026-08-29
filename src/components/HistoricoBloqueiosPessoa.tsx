import { useMemo } from "react";
import { useBloqueiosDaPessoa } from "../lib/hooks";
import { Bloqueio } from "../lib/tipos";

// Linha do tempo de bloqueios/desbloqueios de uma pessoa (025-bloqueio-pessoa).
// Consome o append-only `bloqueios` via useBloqueiosDaPessoa (ordem cronologica).
export function HistoricoBloqueiosPessoa({ pessoaId }: { pessoaId: string }) {
  const { itens: bloqueios, carregando } = useBloqueiosDaPessoa(pessoaId);

  const ordenados = useMemo(
    () => [...bloqueios].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    [bloqueios]
  );

  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando...</p>;
  }

  if (ordenados.length === 0) {
    return (
      <p className="text-ardesia text-sm">
        Nenhum bloqueio ou desbloqueio registrado para esta pessoa.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ardesia">
        {ordenados.length} solicitação(ões) registrada(s)
      </p>
      <div className="card">
        <div className="card-corpo divide-y divide-pietra-clara">
          {ordenados.map((b) => (
            <LinhaBloqueio key={b.id} bloqueio={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LinhaBloqueio({ bloqueio: b }: { bloqueio: Bloqueio }) {
  const ehBloqueio = b.tipo === "bloqueio";
  return (
    <div className="py-3 first:pt-0 last:pb-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`badge ${ehBloqueio ? "badge-vermelho" : "badge-verde"}`}
        >
          {ehBloqueio ? "Bloqueio" : "Desbloqueio"}
        </span>
        <span
          className={`badge ${
            b.status === "aprovado" ? "badge-azul" : "badge-cinza"
          }`}
        >
          {b.status === "aprovado" ? "Aprovado" : "Pendente"}
        </span>
        <span className="text-xs text-ardesia font-mono ml-auto">
          {formatarDataHora(b.criadoEm)}
        </span>
      </div>
      <p className="text-sm text-carbone whitespace-pre-wrap">{b.motivo}</p>
      <div className="text-xs text-ardesia">
        Solicitado por {b.criadoPorNome}
        {" · 1º aprovador "}
        {b.aprovador1Nome}
        {b.aprovador2Nome ? ` · 2º aprovador ${b.aprovador2Nome}` : ""}
        {b.concluidoEm ? ` · concluído em ${formatarDataHora(b.concluidoEm)}` : ""}
      </div>
    </div>
  );
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}