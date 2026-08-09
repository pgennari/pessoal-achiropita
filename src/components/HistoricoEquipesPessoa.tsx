import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEdicoes, useHistoricoEquipesPessoa } from "../lib/hooks";
import { Funcao } from "../lib/tipos";

function corDaFuncao(f: Funcao): string {
  if (f === "Coordenador") return "badge badge-ouro";
  if (f === "Equipista") return "badge badge-verde";
  return "badge badge-azul";
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

export function HistoricoEquipesPessoa({ pessoaId }: { pessoaId: string }) {
  const { itens: historico, carregando } = useHistoricoEquipesPessoa(pessoaId);
  const { itens: edicoes } = useEdicoes();

  const indiceEdicoes = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edicoes) m.set(e.id, e.numero);
    return m;
  }, [edicoes]);

  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando histórico...</p>;
  }

  if (historico.length === 0) {
    return (
      <p className="text-ardesia text-sm">
        Nenhuma movimentação entre equipes registrada.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-pietra-clara">
      {historico.map((h) => {
        const numero = indiceEdicoes.get(h.edicaoId);
        return (
          <li key={h.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-carbone">
                {h.equipeDestinoNome && h.equipeOrigemNome ? (
                  <>
                    {h.equipeOrigemNome}
                    <span className="text-ardesia"> → </span>
                    {h.equipeDestinoId ? (
                      <Link
                        to={`/edicoes/${h.edicaoId}/equipes/${h.equipeDestinoId}`}
                        className="hover:text-verde"
                      >
                        {h.equipeDestinoNome}
                      </Link>
                    ) : (
                      h.equipeDestinoNome
                    )}
                  </>
                ) : h.equipeDestinoNome ? (
                  <>
                    Alocado(a) na equipe{" "}
                    {h.equipeDestinoId ? (
                      <Link
                        to={`/edicoes/${h.edicaoId}/equipes/${h.equipeDestinoId}`}
                        className="hover:text-verde"
                      >
                        {h.equipeDestinoNome}
                      </Link>
                    ) : (
                      h.equipeDestinoNome
                    )}
                  </>
                ) : (
                  <>
                    Removido(a) da equipe{" "}
                    <span className="text-vermelho-escuro">
                      {h.equipeOrigemNome}
                    </span>
                  </>
                )}
              </span>
              <span className="text-xs text-ardesia">
                {formatarDataHora(h.criadoEm)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-ardesia">
              {numero ? `${numero}ª edição` : "Edição desconhecida"}
              <span className={corDaFuncao(h.funcao)}>{h.funcao}</span>
            </div>
            <div className="text-xs text-ardesia mt-1">por {h.autorNome}</div>
          </li>
        );
      })}
    </ul>
  );
}
