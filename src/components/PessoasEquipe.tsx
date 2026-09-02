import { useEffect } from "react";
import { usePessoasDaEquipe } from "../lib/hooks";
import { Icone } from "./Icone";

export interface PessoasEquipeProps {
  aberto: boolean;
  onFechar: () => void;
  edicaoId: string;
  equipeId: string;
  equipeNome: string;
}

export function PessoasEquipe({
  aberto,
  onFechar,
  edicaoId,
  equipeId,
  equipeNome,
}: PessoasEquipeProps) {
  const { itens, carregando } = usePessoasDaEquipe(edicaoId, equipeId);

  useEffect(() => {
    if (!aberto) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-carbone/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Pessoas da equipe ${equipeNome}`}
      onClick={onFechar}
    >
      <aside
        className="fixed inset-y-0 right-0 flex w-full max-w-md flex-col bg-bianco shadow-media"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-pietra-clara px-5 py-4">
          <div className="mr-auto min-w-0">
            <div className="eyebrow">Pessoas da equipe</div>
            <h3 className="mt-1 truncate">{equipeNome}</h3>
          </div>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={onFechar}
            aria-label="Fechar"
            title="Fechar"
          >
            <Icone nome="fechar" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {carregando && (
            <p className="px-5 py-6 text-ardesia">Carregando...</p>
          )}
          {!carregando && itens.length === 0 && (
            <p className="px-5 py-6 text-center text-ardesia">
              Nenhuma pessoa nesta equipe.
            </p>
          )}
          {!carregando && itens.length > 0 && (
            <div>
              <div className="px-5 py-2 font-mono text-xs text-ardesia border-b border-pietra-clara">
                {itens.length} {itens.length === 1 ? "pessoa" : "pessoas"}
              </div>
              <ul className="divide-y divide-pietra-clara">
                {itens.map((p) => (
                  <li key={p.participacao.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-carbone truncate">
                          {p.pessoa?.nome ?? "Pessoa nao encontrada"}
                        </div>
                        <div className="font-mono text-xs text-ardesia">
                          #{p.pessoa?.cracha ?? "—"}
                        </div>
                      </div>
                      <span
                        className={`badge shrink-0 ${
                          p.participacao.funcao === "Coordenador"
                            ? "badge-ouro"
                            : "badge-verde"
                        }`}
                      >
                        {p.participacao.funcao}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-pietra-clara px-5 py-3 font-mono text-xs text-ardesia">
          <span>
            {itens.length} {itens.length === 1 ? "pessoa" : "pessoas"}
          </span>
          <span>esc fechar</span>
        </footer>
      </aside>
    </div>
  );
}
