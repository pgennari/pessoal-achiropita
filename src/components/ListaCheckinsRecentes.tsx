import type { CheckinResumo } from "../lib/dashboard";

interface Props {
  checkins: CheckinResumo[];
  carregando: boolean;
}

function formatarHora(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ListaCheckinsRecentes({ checkins, carregando }: Props) {
  if (carregando) {
    return (
      <p className="text-ardesia text-sm">Carregando check-ins...</p>
    );
  }

  if (checkins.length === 0) {
    return (
      <p className="text-ardesia text-sm">
        Nenhum check-in realizado hoje.
      </p>
    );
  }

  return (
    <div className="tabela-rolavel">
      <table className="tabela-larga">
        <thead>
          <tr className="border-b border-pietra-clara text-ardesia text-sm text-left">
            <th className="pb-2 font-semibold">Horario</th>
            <th className="pb-2 font-semibold">Pessoa</th>
            <th className="pb-2 font-semibold">Placa</th>
            <th className="pb-2 font-semibold hidden sm:table-cell">
              Modelo / Cor
            </th>
            <th className="pb-2 font-semibold">Estacionamento</th>
          </tr>
        </thead>
        <tbody>
          {checkins.map((ck) => (
            <tr
              key={ck.id}
              className="border-b border-pietra-clara last:border-0 text-sm"
            >
              <td className="py-2 pr-3 font-mono text-ardesia">
                {formatarHora(ck.timestamp)}
              </td>
              <td className="py-2 pr-3 text-carbone font-medium">
                {ck.pessoaNome}
              </td>
              <td className="py-2 pr-3 font-mono font-semibold text-carbone">
                {ck.placa}
              </td>
              <td className="py-2 pr-3 text-ardesia hidden sm:table-cell">
                {ck.modelo} ({ck.cor})
              </td>
              <td className="py-2 text-ardesia">{ck.estacionamentoNome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
