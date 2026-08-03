import { useState, useMemo } from "react";
import type { Veiculo } from "../lib/tipos";
import { Icone } from "./Icone";

interface VinculoVeiculoProps {
  titulo: string;
  veiculosDisponiveis: Veiculo[];
  veiculosVinculados: Veiculo[];
  aoVincular: (veiculoId: string) => Promise<void>;
  aoDesvincular: (veiculoId: string) => Promise<void>;
  carregando?: boolean;
}

export function VinculoVeiculo({
  titulo,
  veiculosDisponiveis,
  veiculosVinculados,
  aoVincular,
  aoDesvincular,
  carregando: _carregando,
}: VinculoVeiculoProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const veiculosFiltrados = useMemo(() => {
    if (!busca.trim()) return veiculosDisponiveis;
    const termo = busca.trim().toLowerCase();
    return veiculosDisponiveis.filter(
      (v) =>
        v.placa.toLowerCase().includes(termo) ||
        v.modelo?.toLowerCase().includes(termo) ||
        v.fabricante?.toLowerCase().includes(termo) ||
        v.cor?.toLowerCase().includes(termo)
    );
  }, [veiculosDisponiveis, busca]);

  const handleVincular = async (veiculoId: string) => {
    setProcessando(veiculoId);
    try {
      await aoVincular(veiculoId);
      setBusca("");
      setModalAberto(false);
    } finally {
      setProcessando(null);
    }
  };

  const handleDesvincular = async (veiculoId: string) => {
    setProcessando(veiculoId);
    try {
      await aoDesvincular(veiculoId);
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="border border-pietra-clara rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-carbone">{titulo}</h3>
        <button
          onClick={() => setModalAberto(true)}
          className="btn btn-secundario btn-pequeno"
          aria-label="Vincular veiculo"
          title="Vincular veiculo"
        >
          <Icone nome="mais" />
        </button>
      </div>

      {veiculosVinculados.length === 0 ? (
        <p className="text-sm text-ardesia">Nenhum veiculo vinculado.</p>
      ) : (
        <ul className="divide-y divide-pietra-clara">
          {veiculosVinculados.map((v) => (
            <li key={v.id} className="py-2 flex items-center justify-between">
              <div>
                <span className="font-semibold text-carbone font-mono">{v.placa}</span>
                <span className="text-ardesia ml-2 text-sm">
                  {v.fabricante} {v.modelo} - {v.cor}
                </span>
              </div>
              <button
                onClick={() => handleDesvincular(v.id)}
                disabled={processando === v.id}
                className="btn btn-perigo btn-pequeno"
                aria-label="Remover veiculo"
                title="Remover veiculo"
              >
                <Icone nome="lixeira" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-carbone/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="card-corpo flex flex-col flex-1 min-h-0">
              <h4 className="text-lg font-semibold text-carbone mb-3">Selecionar Veiculo</h4>

              <div className="input-grupo mb-3">
                <input
                  className="input"
                  placeholder="Buscar por placa, modelo, fabricante ou cor..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {veiculosFiltrados.length === 0 ? (
                  <p className="text-sm text-ardesia">
                    {busca ? "Nenhum veiculo encontrado para esta busca." : "Nenhum veiculo disponivel para vincular."}
                  </p>
                ) : (
                  <ul className="divide-y divide-pietra-clara">
                    {veiculosFiltrados.map((v) => (
                      <li key={v.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-carbone font-mono">{v.placa}</span>
                          <span className="text-ardesia ml-2 text-sm">
                            {v.fabricante} {v.modelo} - {v.cor}
                          </span>
                        </div>
                        <button
                          onClick={() => handleVincular(v.id)}
                          disabled={processando === v.id}
                          className="btn btn-primario btn-pequeno"
                          aria-label="Vincular"
                          title="Vincular"
                        >
                          <Icone nome="mais" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-pietra-clara flex justify-end">
                <button
                  onClick={() => {
                    setBusca("");
                    setModalAberto(false);
                  }}
                  className="btn btn-secundario"
                  aria-label="Fechar"
                  title="Fechar"
                >
                  <Icone nome="fechar" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
