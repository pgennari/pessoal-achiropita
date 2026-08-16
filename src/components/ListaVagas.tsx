// Lista de vagas de um estacionamento (aba Vagas do EstacionamentoDetalhe).
import { Link } from "react-router-dom";
import { Vaga } from "../lib/tipos";

interface Props {
  vagas: Vaga[];
  carregando?: boolean;
}

export function ListaVagas({ vagas, carregando }: Props) {
  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando vagas...</p>;
  }

  if (vagas.length === 0) {
    return (
      <div className="card">
        <div className="card-corpo text-center text-ardesia text-sm">
          Nenhuma vaga vinculada a este estacionamento.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-corpo divide-y divide-pietra-clara">
        {vagas.map((v) => (
          <div key={v.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link
                to={`/vagas/${v.id}`}
                className="font-semibold text-carbone hover:text-verde no-underline hover:underline"
              >
                {v.identificacao}
              </Link>
              <div className="text-sm text-ardesia shrink-0">
                {v.pessoas.length} pessoa{v.pessoas.length === 1 ? "" : "s"}
              </div>
            </div>
            {v.pessoas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {v.pessoas.map((p) => (
                  <span key={p.id} className="badge badge-cinza">
                    {p.nome}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
