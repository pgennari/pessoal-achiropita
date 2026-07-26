import { Checkin } from "../lib/tipos";

interface Props {
  checkins: Checkin[];
  carregando: boolean;
}

interface GrupoDia {
  data: string;
  itens: Checkin[];
}

function agruparPorData(checkins: Checkin[]): GrupoDia[] {
  const porData = new Map<string, Checkin[]>();
  for (const ck of checkins) {
    const d = new Date(ck.timestamp);
    const chave = d.toLocaleDateString("pt-BR");
    const lista = porData.get(chave) ?? [];
    lista.push(ck);
    porData.set(chave, lista);
  }
  const grupos: GrupoDia[] = [];
  for (const [data, itens] of porData) {
    itens.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    grupos.push({ data, itens });
  }
  return grupos;
}

export function ListaCheckins({ checkins, carregando }: Props) {
  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando check-ins...</p>;
  }

  if (checkins.length === 0) {
    return (
      <p className="text-ardesia text-sm">Nenhum check-in registrado.</p>
    );
  }

  const grupos = agruparPorData(checkins);

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => (
        <div key={grupo.data}>
          <h4 className="text-ardesia mb-2">{grupo.data}</h4>
          <div className="space-y-1">
            {grupo.itens.map((ck) => {
              const hora = new Date(ck.timestamp).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={ck.id}
                  className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-pietra-clara last:border-0"
                >
                  <span className="font-mono text-ardesia">{hora}</span>
                  <span className="flex-1 truncate text-carbone">
                    {ck.pessoaNome}
                  </span>
                  <span className="font-mono font-semibold text-carbone">
                    {ck.placa}
                  </span>
                  <span className="text-ardesia hidden sm:inline">
                    {ck.modelo} ({ck.cor})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
