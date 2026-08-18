// Grade visual de presença: equipes (eixo Y) × dias de festa (eixo X).
// Cada célula exibe confirmados/total com cores por porcentagem.
import { Link } from "react-router-dom";
import { ResumoEquipePresencaDia } from "../lib/hooks";
import { DiaFesta } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

interface Props {
  dias: DiaFesta[];
  resumoEquipes: ResumoEquipePresencaDia[];
  edicaoId: string;
  carregando?: boolean;
}

function corFundo(pct: number | null): string {
  if (pct === null) return "bg-pietra-clara";
  if (pct < 50) return "bg-vermelho/10";
  if (pct < 75) return "bg-ouro/15";
  return "bg-verde/10";
}

function corTexto(pct: number | null): string {
  if (pct === null) return "text-ardesia";
  if (pct < 50) return "text-vermelho-escuro";
  if (pct < 75) return "text-ouro-texto";
  return "text-verde-escuro";
}

function porcentagem(conf: number, total: number): number | null {
  if (total <= 0) return null;
  return (conf / total) * 100;
}

export function GradePresenca({
  dias,
  resumoEquipes,
  edicaoId,
  carregando,
}: Props) {
  const diasOrdenados = [...dias].sort((a, b) => a.data.localeCompare(b.data));

  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando grade...</p>;
  }

  if (diasOrdenados.length === 0 || resumoEquipes.length === 0) {
    return null;
  }

  // Coleta todas as equipes únicas (ordenadas por nome)
  const equipesMap = new Map<string, string>();
  for (const r of resumoEquipes) {
    if (!equipesMap.has(r.equipeId)) {
      equipesMap.set(r.equipeId, r.equipeNome);
    }
  }
  const equipes = Array.from(equipesMap.entries()).sort((a, b) =>
    a[1].localeCompare(b[1], "pt-BR")
  );

  // Monta lookup: equipeId -> diaFestaId -> {confirmados, total}
  const lookup = new Map<string, Map<string, { conf: number; total: number }>>();
  for (const r of resumoEquipes) {
    let porDia = lookup.get(r.equipeId);
    if (!porDia) {
      porDia = new Map();
      lookup.set(r.equipeId, porDia);
    }
    porDia.set(r.diaFestaId, { conf: r.confirmados, total: r.total });
  }

  // Totais por dia (para linha de rodapé)
  const totaisPorDia = diasOrdenados.map((dia) => {
    let conf = 0;
    let total = 0;
    for (const r of resumoEquipes) {
      if (r.diaFestaId === dia.id) {
        conf += r.confirmados;
        total += r.total;
      }
    }
    return { conf, total };
  });

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-pietra-clara/60">
              <th className="px-3 py-2 text-left font-semibold text-carbone sticky left-0 bg-bianco z-10 min-w-[120px]">
                Equipe
              </th>
              {diasOrdenados.map((dia) => (
                <th
                  key={dia.id}
                  className="px-3 py-2 text-center font-semibold text-carbone whitespace-nowrap"
                >
                  {formatarData(dia.data).slice(0, 5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipes.map(([equipeId, equipeNome]) => (
              <tr key={equipeId} className="border-t border-pietra-clara">
                <td className="px-3 py-1.5 sticky left-0 bg-bianco z-10 border-r border-pietra-clara">
                  <Link
                    to={`/edicoes/${edicaoId}/equipes/${equipeId}`}
                    className="text-xs text-carbone font-semibold no-underline hover:text-verde hover:underline truncate block max-w-[140px]"
                  >
                    {equipeNome}
                  </Link>
                </td>
                {diasOrdenados.map((dia) => {
                  const celula = lookup.get(equipeId)?.get(dia.id);
                  const pct = celula
                    ? porcentagem(celula.conf, celula.total)
                    : null;
                  return (
                    <td key={dia.id} className="px-1 py-1.5 text-center">
                      <div
                        className={`rounded-sm px-2 py-1 ${corFundo(pct)}`}
                        title={`${equipeNome} — ${formatarData(dia.data).slice(0, 5)}`}
                      >
                        <span
                          className={`text-xs font-display font-semibold ${corTexto(pct)}`}
                        >
                          {celula
                            ? `${celula.conf}/${celula.total}`
                            : "—"}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-pietra-clara bg-pietra-clara/30 font-semibold">
              <td className="px-3 py-2 text-left text-carbone sticky left-0 bg-pietra-clara/30 z-10 border-r border-pietra-clara">
                Total
              </td>
              {totaisPorDia.map((t, i) => {
                const pct = porcentagem(t.conf, t.total);
                return (
                  <td key={diasOrdenados[i].id} className="px-1 py-1.5 text-center">
                    <span className={`text-xs font-display ${corTexto(pct)}`}>
                      {t.conf}/{t.total}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
