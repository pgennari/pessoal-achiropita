import { useMemo, useState } from "react";
import { Parentesco, Pessoa } from "../lib/tipos";
import { opcoesParentescoDoParametro } from "../lib/parametros";
import { useParametros } from "../lib/hooks";
import { Icone } from "./Icone";

interface Props {
  pessoa: Pessoa;
  pessoas: Pessoa[];
  parentes: Parentesco[];
  podeEditar: boolean;
  aoAdicionar: (parenteId: string, parentesco: string) => Promise<void>;
  aoRemover: (parenteId: string) => Promise<void>;
}

export function EditarParentes({
  pessoa,
  pessoas,
  parentes,
  podeEditar,
  aoAdicionar,
  aoRemover,
}: Props) {
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [parenteId, setParenteId] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { itens: parametros } = useParametros();
  const pares = opcoesParentescoDoParametro(parametros);

  const idsVinculados = useMemo(
    () => new Set(parentes.map((p) => p.parenteId)),
    [parentes]
  );

  const pessoasDisponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pessoas.filter((p) => {
      if (p.id === pessoa.id || idsVinculados.has(p.id)) return false;
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        String(p.cracha).includes(termo)
      );
    });
  }, [pessoas, busca, idsVinculados, pessoa.id]);

  function abrirModal() {
    setBusca("");
    setParenteId("");
    setParentesco(pares[0]?.ida ?? "");
    setErro(null);
    setModalAberto(true);
  }

  async function confirmar() {
    if (!parenteId || !parentesco) {
      setErro("Selecione a pessoa e o parentesco.");
      return;
    }
    setProcessando("salvar");
    setErro(null);
    try {
      await aoAdicionar(parenteId, parentesco);
      setModalAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao vincular.");
    } finally {
      setProcessando(null);
    }
  }

  async function handleRemover(pid: string) {
    setProcessando(pid);
    setErro(null);
    try {
      await aoRemover(pid);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao remover.");
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-carbone">Parentes</h3>
        {podeEditar && (
          <button
            type="button"
            className="btn btn-secundario btn-pequeno"
            onClick={abrirModal}
            aria-label="Adicionar parente"
            title="Adicionar parente"
          >
            <Icone nome="mais" />
          </button>
        )}
      </div>

      {erro && <p className="input-erro-msg mb-3">{erro}</p>}

      {parentes.length === 0 ? (
        <p className="text-ardesia text-sm">Nenhum parente vinculado.</p>
      ) : (
        <ul className="divide-y divide-pietra-clara">
          {parentes.map((p) => (
            <li
              key={p.parenteId}
              className="py-3 flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-semibold text-carbone">
                  {p.parenteNome}
                  <span className="font-mono text-ardesia ml-2 text-sm">
                    #{p.parenteCracha}
                  </span>
                </div>
                <span className="badge badge-azul mt-1">{p.parentesco}</span>
              </div>
              {podeEditar && (
                <button
                  type="button"
                  className="btn btn-perigo btn-pequeno"
                  onClick={() => handleRemover(p.parenteId)}
                  disabled={processando === p.parenteId}
                  aria-label="Remover parente"
                  title="Remover parente"
                >
                  <Icone nome="lixeira" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-carbone/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="card-corpo flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-carbone m-0">
                  Vincular parente
                </h4>
                <button
                  onClick={() => setModalAberto(false)}
                  className="btn btn-texto btn-pequeno"
                  aria-label="Fechar"
                  title="Fechar"
                >
                  <Icone nome="fechar" />
                </button>
              </div>

              <div className="input-grupo mb-3">
                <input
                  className="input"
                  placeholder="Buscar por nome ou crachá..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 mb-3">
                {pessoasDisponiveis.length === 0 ? (
                  <p className="text-sm text-ardesia">
                    {busca
                      ? "Nenhuma pessoa encontrada para esta busca."
                      : "Nenhuma pessoa disponível para vincular."}
                  </p>
                ) : (
                  <ul className="divide-y divide-pietra-clara border border-pietra-clara rounded-lg">
                    {pessoasDisponiveis.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`w-full text-left px-3 py-2 hover:bg-pietra-clara/40 ${
                            parenteId === p.id ? "bg-pietra-clara/60" : ""
                          }`}
                          onClick={() => setParenteId(p.id)}
                          aria-pressed={parenteId === p.id}
                        >
                          <span className="font-semibold text-carbone">
                            {p.nome}
                          </span>
                          <span className="font-mono text-ardesia ml-2 text-sm">
                            #{p.cracha}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="input-grupo">
                <label className="input-label" htmlFor="parentesco">
                  Parentesco
                </label>
                <select
                  id="parentesco"
                  className="input"
                  value={parentesco}
                  onChange={(e) => setParentesco(e.target.value)}
                >
                  {pares.map((par) => (
                    <option key={par.ida} value={par.ida}>
                      {par.ida}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 pt-3 border-t border-pietra-clara flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setModalAberto(false)}
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Icone nome="fechar" />
                </button>
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={confirmar}
                  disabled={processando === "salvar" || !parenteId}
                  aria-label="Confirmar vínculo"
                  title="Confirmar vínculo"
                >
                  <Icone nome="check" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
