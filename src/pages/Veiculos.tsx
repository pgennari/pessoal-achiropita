import { Link, useNavigate } from "react-router-dom";
import { useEstacionamentos, useVeiculos } from "../lib/hooks";
import { useSessao } from "../lib/sessao";

export function Veiculos() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens, carregando, erro } = useVeiculos();
  const { itens: estacionamentos } = useEstacionamentos();
  const mapaEstacionamento = new Map(estacionamentos.map((e) => [e.id, e.nome]));

  const podeCriar = sessao?.perfil === "ADM" || sessao?.perfil === "ORG";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Festa</div>
          <h2 className="mt-1">Veiculos</h2>
          <p className="text-ardesia text-sm">
            {carregando ? "Carregando..." : `${itens.length} registros`}
          </p>
        </div>
        {podeCriar && (
          <Link to="/veiculos/novo" className="btn btn-primario">
            Novo veiculo
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
            Nenhum veiculo cadastrado.
          </div>
        </div>
      )}

      {itens.length > 0 && (
        <div className="card">
          <div className="card-corpo overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cinza-200">
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Placa</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Fabricante</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Modelo</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Cor</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Estacionamento</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Pessoas</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-cinza-100 hover:bg-cinza-50 cursor-pointer"
                    onClick={() => navigate(`/veiculos/${v.id}`)}
                  >
                    <td className="py-2 px-3 font-mono font-medium">{v.placa}</td>
                    <td className="py-2 px-3">{v.fabricante}</td>
                    <td className="py-2 px-3">{v.modelo}</td>
                    <td className="py-2 px-3">{v.cor}</td>
                    <td className="py-2 px-3">
                      {v.estacionamentoId ? (
                        mapaEstacionamento.get(v.estacionamentoId) ?? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-verde/10 text-verde-escuro">
                            Vinculado
                          </span>
                        )
                      ) : (
                        <span className="text-ardesia">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {v.pessoas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {v.pessoas.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-azul/10 text-azul-escuro"
                            >
                              {p.nome}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ardesia">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
