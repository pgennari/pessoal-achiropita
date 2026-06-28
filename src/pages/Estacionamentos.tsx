import { Link, useNavigate } from "react-router-dom";
import { useEstacionamentos } from "../lib/hooks";
import { useSessao } from "../lib/sessao";

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

      <div className="card overflow-hidden">
        <div className="tabela-rolavel">
          <table className="tabela-larga">
            <thead className="bg-pietra-clara/60 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Endereco</th>
                <th className="px-4 py-3 font-semibold text-right">Vagas Contratadas</th>
                <th className="px-4 py-3 font-semibold text-right">Vagas Distribuidas</th>
                <th className="px-4 py-3 font-semibold text-right">Diferença</th>
                <th className="px-4 py-3 font-semibold hidden sm:table-cell">
                  Perimetro
                </th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">
                  Horarios
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && !carregando && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ardesia">
                    Nenhum estacionamento cadastrado.
                  </td>
                </tr>
              )}
              {itens.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-pietra-clara hover:bg-pietra-clara/40 cursor-pointer"
                  onClick={() => navigate(`/estacionamentos/${e.id}`)}
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/estacionamentos/${e.id}`}
                      className="font-semibold text-carbone hover:text-verde"
                    >
                      {e.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ardesia">{e.endereco}</td>
                  <td className="px-4 py-3 font-mono text-ardesia text-right">
                    {e.vagasContratadas}
                  </td>
                  <td className="px-4 py-3 font-mono text-ardesia text-right">
                    {e.vagasDistribuidas}
                  </td>
                  <td className="px-4 py-3 font-mono text-ardesia text-right">
                    {e.vagasContratadas - e.vagasDistribuidas}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {e.dentroPerimetro ? (
                      <span className="badge badge-verde">sim</span>
                    ) : (
                      <span className="badge badge-cinza">nao</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ardesia">
                    {e.horarios}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
