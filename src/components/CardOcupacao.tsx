import type { EstacionamentoComOcupacao } from "../lib/dashboard";

interface Props {
  estacionamento: EstacionamentoComOcupacao;
}

function corOcupacao(percentual: number | null): string {
  if (percentual === null) return "";
  if (percentual <= 50) return "bg-verde";
  if (percentual <= 80) return "bg-ouro";
  return "bg-vermelho";
}

function textoCorOcupacao(percentual: number | null): string {
  if (percentual === null) return "";
  if (percentual <= 50) return "text-verde-escuro";
  if (percentual <= 80) return "text-ouro-texto";
  return "text-vermelho-escuro";
}

export function CardOcupacao({ estacionamento }: Props) {
  const { nome, vagasContratadas, checkinsHoje, ocupacaoPercentual } =
    estacionamento;

  return (
    <div className="card">
      <div className="card-corpo space-y-3">
        <div className="space-y-1">
          <h3 className="text-xl font-display text-carbone min-h-14">{nome}</h3>
        </div>

        <div className="border-t border-pietra-clara" />

        <div className="flex items-baseline gap-2">
          <span className="text-sm text-ardesia">Vagas:</span>
          <span className="font-semibold text-carbone">{vagasContratadas}</span>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-medium text-carbone">
              Ocupacao
            </span>
            <span
              className={`text-lg font-display font-semibold ${textoCorOcupacao(ocupacaoPercentual)}`}
            >
              {ocupacaoPercentual !== null
                ? `${ocupacaoPercentual}%`
                : "N/A"}
            </span>
          </div>

          {ocupacaoPercentual !== null && (
            <div className="h-3 bg-pietra-clara rounded-sm overflow-hidden">
              <div
                className={`h-full rounded-sm transition-all duration-500 ${corOcupacao(ocupacaoPercentual)}`}
                style={{ width: `${Math.min(ocupacaoPercentual, 100)}%` }}
              />
            </div>
          )}

          <div className="flex flex-col text-xs text-ardesia mt-1">
            <span>{checkinsHoje} check-ins hoje</span>
            {ocupacaoPercentual !== null && (
              <span>
                {vagasContratadas - checkinsHoje > 0
                  ? `${vagasContratadas - checkinsHoje} vagas restantes`
                  : "Lotado"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
