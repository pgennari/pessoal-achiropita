import { useState, useEffect, useMemo } from "react";
import { useVeiculosEstacionamento, useVeiculos } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  associarVeiculoEstacionamento,
  desassociarVeiculoEstacionamento,
} from "../lib/veiculos";

interface Props {
  estacionamentoId: string;
}

function useDebounce(valor: string, atraso: number) {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), atraso);
    return () => clearTimeout(timer);
  }, [valor, atraso]);
  return debounced;
}

export function ListaVeiculosEstacionamento({ estacionamentoId }: Props) {
  const { sessao } = useSessao();
  const { itens: veiculosEstacionamento, carregando } = useVeiculosEstacionamento(estacionamentoId);
  const { itens: todosVeiculos } = useVeiculos();
  const [busca, setBusca] = useState("");
  const [buscaAssociacao, setBuscaAssociacao] = useState("");
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const buscaDebounced = useDebounce(busca, 300);
  const buscaAssociacaoDebounced = useDebounce(buscaAssociacao, 300);

  const podeEditar = sessao?.perfil === "ADM" || sessao?.perfil === "ORG";

  const veiculosFiltrados = useMemo(() => {
    if (!buscaDebounced.trim()) return veiculosEstacionamento;
    const termo = buscaDebounced.toLowerCase();
    return veiculosEstacionamento.filter(
      (v) =>
        v.fabricante.toLowerCase().includes(termo) ||
        v.modelo.toLowerCase().includes(termo) ||
        v.cor.toLowerCase().includes(termo) ||
        v.placa.toLowerCase().includes(termo) ||
        v.pessoas.some(
          (p) =>
            p.nome.toLowerCase().includes(termo) ||
            String(p.cracha).includes(termo)
        )
    );
  }, [veiculosEstacionamento, buscaDebounced]);

  const veiculosNaoAssociados = useMemo(() => {
    const livres = todosVeiculos.filter((v) => !v.estacionamentoId);
    if (!buscaAssociacaoDebounced.trim()) return livres;
    const termo = buscaAssociacaoDebounced.toLowerCase();
    return livres.filter(
      (v) =>
        v.fabricante.toLowerCase().includes(termo) ||
        v.modelo.toLowerCase().includes(termo) ||
        v.cor.toLowerCase().includes(termo) ||
        v.placa.toLowerCase().includes(termo)
    );
  }, [todosVeiculos, buscaAssociacaoDebounced]);

  if (!sessao) return null;

  async function handleAssociar(veiculoId: string) {
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await associarVeiculoEstacionamento(estacionamentoId, veiculoId);
      setBuscaAssociacao("");
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao associar.");
    } finally {
      setAcaoOcupado(false);
    }
  }

  async function handleDesassociar(veiculoId: string) {
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await desassociarVeiculoEstacionamento(estacionamentoId, veiculoId);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao desassociar.");
    } finally {
      setAcaoOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-carbone">Veículos Associados</h4>
        <span className="text-sm text-ardesia">
          {veiculosEstacionamento.length} veículo(s)
        </span>
      </div>

      {acaoErro && (
        <div className="text-sm text-vermelho-escuro">{acaoErro}</div>
      )}

      <input
        type="text"
        className="input"
        placeholder="Buscar por fabricante, modelo, cor, placa, nome ou cracha..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar veículos"
      />

      {carregando ? (
        <p className="text-ardesia text-sm">Carregando...</p>
      ) : veiculosFiltrados.length === 0 ? (
        <p className="text-ardesia text-sm">
          {busca.trim() ? "Nenhum veiculo encontrado." : "Nenhum veiculo associado."}
        </p>
      ) : (
        <ul className="divide-y divide-pietra-clara" role="list">
          {veiculosFiltrados.map((v) => (
            <li
              key={v.id}
              className="py-3 flex items-center justify-between gap-3"
              role="listitem"
            >
              <div>
                <div className="font-semibold text-carbone">
                  {v.fabricante} {v.modelo}
                </div>
                <div className="text-xs text-ardesia font-mono">
                  {v.placa} · {v.cor}
                </div>
                {v.pessoas.length > 0 && (
                  <div className="text-xs text-ardesia mt-1">
                    Pessoas: {v.pessoas.map((p) => p.nome).join(", ")}
                  </div>
                )}
              </div>
              {podeEditar && (
                <button
                  type="button"
                  className="btn btn-perigo btn-pequeno"
                  onClick={() => handleDesassociar(v.id)}
                  disabled={acaoOcupado}
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <div className="mt-4 pt-4 border-t border-pietra-clara">
          <h5 className="text-sm font-medium text-ardesia mb-2">
            Associar novo veículo
          </h5>
          {todosVeiculos.filter((v) => !v.estacionamentoId).length === 0 ? (
            <p className="text-sm text-ardesia">
              Todos os veículos já estão associados a estacionamentos.
            </p>
          ) : (
            <>
              <input
                type="text"
                className="input mb-2"
                placeholder="Buscar veiculo para associar..."
                value={buscaAssociacao}
                onChange={(e) => setBuscaAssociacao(e.target.value)}
                aria-label="Buscar veículos para associar"
              />
              {veiculosNaoAssociados.length === 0 ? (
                <p className="text-sm text-ardesia">
                  Nenhum veiculo encontrado.
                </p>
              ) : (
                <ul className="divide-y divide-pietra-clara" role="list">
                  {veiculosNaoAssociados.map((v) => (
                    <li
                      key={v.id}
                      className="py-2 flex items-center justify-between gap-3"
                      role="listitem"
                    >
                      <div>
                        <div className="text-sm font-semibold text-carbone">
                          {v.fabricante} {v.modelo}
                        </div>
                        <div className="text-xs text-ardesia font-mono">
                          {v.placa} · {v.cor}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secundario btn-pequeno"
                        onClick={() => handleAssociar(v.id)}
                        disabled={acaoOcupado}
                      >
                        Associar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
