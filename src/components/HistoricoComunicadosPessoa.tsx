import { useMemo } from "react";
import { useComunicadosDaPessoa } from "../lib/hooks";
import { ComunicadoDisparoPessoa } from "../lib/tipos";

// Historico de comunicados recebidos pela pessoa (aba "Comunicados" do box
// Exclusivo Pessoal). Consome o append-only `comunicado_disparo_pessoa` via
// useComunicadosDaPessoa (ordem cronologica reversa).
export function HistoricoComunicadosPessoa({ pessoaId }: { pessoaId: string }) {
  const { itens: historico, carregando } = useComunicadosDaPessoa(pessoaId);

  const ordenados = useMemo(
    () => [...historico].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm)),
    [historico]
  );

  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando...</p>;
  }

  if (ordenados.length === 0) {
    return (
      <p className="text-ardesia text-sm">
        Nenhum comunicado enviado por e-mail registrado para esta pessoa.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ardesia">
        {ordenados.length} comunicado(s) recebido(s)
      </p>
      <div className="card">
        <div className="card-corpo divide-y divide-pietra-clara">
          {ordenados.map((d) => (
            <LinhaComunicado key={d.id} disparo={d} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LinhaComunicado({ disparo: d }: { disparo: ComunicadoDisparoPessoa }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-carbone">
          {d.comunicadoTitulo}
        </span>
        <span className="text-xs text-ardesia font-mono">
          {formatarDataHora(d.enviadoEm)}
        </span>
      </div>
      <p className="text-xs text-ardesia">
        Enviado por {d.disparadoPorNome || "—"}
      </p>
    </div>
  );
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
