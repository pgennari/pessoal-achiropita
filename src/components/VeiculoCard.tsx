import type { ResultadoBusca } from "../lib/checkin";

interface VeiculoCardProps {
  veiculo: ResultadoBusca;
  aoCheckin: () => void;
}

export function VeiculoCard({ veiculo, aoCheckin }: VeiculoCardProps) {
  return (
    <div className="card">
      <div className="card-corpo space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-carbone">
              {veiculo.fabricante} {veiculo.modelo}
            </div>
            <div className="text-sm text-ardesia font-mono">{veiculo.placa} · {veiculo.cor}</div>
          </div>
          {veiculo.jaPossuiCheckin ? (
            <span className="badge badge-cinza">Ja registrado</span>
          ) : (
            <button
              type="button"
              className="btn btn-primario btn-pequeno"
              onClick={aoCheckin}
            >
              Check-in
            </button>
          )}
        </div>
        {veiculo.pessoas.length > 0 && (
          <div className="text-sm text-ardesia">
            <span className="font-medium">Pessoas:</span>{" "}
            {veiculo.pessoas.map((p) => p.nome).join(", ")}
          </div>
        )}
        {veiculo.pessoas.length === 0 && (
          <div className="text-sm text-ardesia italic">Nenhuma pessoa vinculada</div>
        )}
      </div>
    </div>
  );
}
