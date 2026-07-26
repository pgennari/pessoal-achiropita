import { Link, useNavigate } from "react-router-dom";
import { useEstacionamentos } from "../lib/hooks";
import { useSessao } from "../lib/sessao";

function BarraOcupacao({
  contratadas,
  distribuidas,
}: {
  contratadas: number;
  distribuidas: number;
}) {
  const pct = contratadas > 0 ? (distribuidas / contratadas) * 100 : 0;
  const pctExibida = Math.min(pct, 100);

  const getCor = () => {
    if (pct > 100)
      return { bar: "bg-vermelho", track: "bg-vermelho/15", texto: "text-vermelho-escuro" };
    if (pct >= 80)
      return { bar: "bg-ouro", track: "bg-ouro/15", texto: "text-ouro-texto" };
    return { bar: "bg-verde", track: "bg-verde/15", texto: "text-verde-escuro" };
  };

  const cor = getCor();

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ardesia">Ocupacao</span>
        <span className={`font-mono text-sm font-semibold ${cor.texto}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className={`h-2.5 rounded-full ${cor.track} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${cor.bar} transition-all`}
          style={{ width: `${pctExibida}%` }}
        />
      </div>
    </div>
  );
}

export function Estacionamentos() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens, carregando, erro } = useEstacionamentos();

  const podeCriar = sessao?.perfil === "ADM" || sessao?.perfil === "ORG";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Festa</div>
          <h2 className="mt-1">Estacionamentos</h2>
          <p className="text-ardesia text-sm">
            {carregando ? "Carregando..." : `${itens.length} registros`}
          </p>
        </div>
        {podeCriar && (
          <Link to="/estacionamentos/novo" className="btn btn-primario">
            Novo estacionamento
          </Link>
        )}
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {!carregando && itens.length === 0 && !erro && (
        <div className="card">
          <div className="card-corpo text-center text-ardesia">
            Nenhum estacionamento cadastrado.
          </div>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {itens.map((e) => {
          const diff = e.vagasContratadas - e.vagasDistribuidas;
          return (
            <div
              key={e.id}
              className="card cursor-pointer hover:shadow-media hover:-translate-y-0.5 transition-all"
              onClick={() => navigate(`/estacionamentos/${e.id}`)}
            >
              <div className="card-corpo space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/estacionamentos/${e.id}`}
                      className="font-semibold text-carbone hover:text-verde no-underline hover:underline"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {e.nome}
                    </Link>
                    <p className="text-ardesia text-sm mt-0.5 truncate">
                      {e.endereco}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {e.tokenCheckin && (
                      <span className="badge badge-verde">link</span>
                    )}
                    {e.dentroPerimetro ? (
                      <span className="badge badge-verde">sim</span>
                    ) : (
                      <span className="badge badge-cinza">nao</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-ardesia">Contratadas: </span>
                    <span className="font-mono font-semibold">
                      {e.vagasContratadas}
                    </span>
                  </div>
                  <div>
                    <span className="text-ardesia">Distribuidas: </span>
                    <span className="font-mono font-semibold">
                      {e.vagasDistribuidas}
                    </span>
                  </div>
                  <div>
                    <span className="text-ardesia">Saldo: </span>
                    <span
                      className={`font-mono font-semibold ${diff < 0 ? "text-vermelho-escuro" : "text-verde-escuro"
                        }`}
                    >
                      {diff}
                    </span>
                  </div>
                </div>

                <BarraOcupacao
                  contratadas={e.vagasContratadas}
                  distribuidas={e.vagasDistribuidas}
                />

                <p className="text-ardesia text-sm">{e.horarios}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
