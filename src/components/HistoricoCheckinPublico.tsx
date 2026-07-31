import { useState } from "react";
import { DadosHistoricoPublico, DiaHistorico, CheckinHistorico } from "../lib/checkin";

interface Props {
  historico: DadosHistoricoPublico | null;
  carregando: boolean;
}

function hojeStr(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function dataEmMs(data: string): number {
  const [dia, mes, ano] = data.split("/").map(Number);
  return new Date(ano, mes - 1, dia).getTime();
}

function ordenarDias(dias: DiaHistorico[]): DiaHistorico[] {
  return [...dias].sort((a, b) => dataEmMs(b.data) - dataEmMs(a.data));
}

function formatarHora(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ListaDia({ dia }: { dia: DiaHistorico }) {
  return (
    <div className="space-y-1">
      {dia.checkins.map((ck: CheckinHistorico) => (
        <div
          key={ck.id}
          className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-pietra-clara last:border-0"
        >
          <span className="font-mono text-ardesia">{formatarHora(ck.timestamp)}</span>
          <span className="flex-1 truncate text-carbone">{ck.pessoaNome}</span>
          <span className="font-mono font-semibold text-carbone">{ck.placa}</span>
          <span className="text-ardesia hidden sm:inline">
            {ck.modelo} ({ck.cor})
          </span>
        </div>
      ))}
    </div>
  );
}

export function HistoricoCheckinPublico({ historico, carregando }: Props) {
  const hoje = hojeStr();
  const dias = ordenarDias(historico?.dias ?? []);
  const temDias = dias.length > 0;

  const diaInicial = dias.find((d) => d.data === hoje) ?? dias[0];
  const [abaAtiva, setAbaAtiva] = useState<string>(diaInicial?.data ?? hoje);

  const diaSelecionado = dias.find((d) => d.data === abaAtiva) ?? dias[0];

  return (
    <div className="space-y-3">
      <h4 className="text-ardesia">Ultimos check-ins realizados</h4>

      {carregando && (
        <p className="text-ardesia text-sm">Carregando check-ins...</p>
      )}

      {!carregando && dias.length === 0 && (
        <p className="text-ardesia text-sm">Nenhum check-in registrado.</p>
      )}

      {!carregando && temDias && (
        <div className="flex gap-1 border-b border-pietra-clara overflow-x-auto">
          {dias.map((d) => {
            const ativa = d.data === abaAtiva;
            const rotulo = d.data === hoje ? `Hoje (${d.total})` : `${d.data} (${d.total})`;
            return (
              <button
                key={d.data}
                onClick={() => setAbaAtiva(d.data)}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  ativa
                    ? "border-primaria text-primaria"
                    : "border-transparent text-ardesia hover:text-carbone"
                }`}
              >
                {rotulo}
              </button>
            );
          })}
        </div>
      )}

      {!carregando && diaSelecionado && (
        <ListaDia dia={diaSelecionado} />
      )}
    </div>
  );
}
