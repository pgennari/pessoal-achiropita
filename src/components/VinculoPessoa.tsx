import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Icone } from "./Icone";

interface VinculoPessoaProps {
  titulo: string;
  pessoasDisponiveis: { id: string; nome: string }[];
  pessoasVinculadas: { id: string; nome: string }[];
  aoVincular: (pessoaId: string) => Promise<void>;
  aoDesvincular: (pessoaId: string) => Promise<void>;
  carregando?: boolean;
  podeEditar?: boolean;
}

export function VinculoPessoa({
  titulo,
  pessoasDisponiveis,
  pessoasVinculadas,
  aoVincular,
  aoDesvincular,
  carregando: _carregando,
  podeEditar = true,
}: VinculoPessoaProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const pessoasFiltradas = useMemo(() => {
    if (!busca.trim()) return pessoasDisponiveis;
    const termo = busca.trim().toLowerCase();
    return pessoasDisponiveis.filter(
      (p) => p.nome.toLowerCase().includes(termo)
    );
  }, [pessoasDisponiveis, busca]);

  const handleVincular = async (pessoaId: string) => {
    setProcessando(pessoaId);
    try {
      await aoVincular(pessoaId);
      setBusca("");
      setModalAberto(false);
    } finally {
      setProcessando(null);
    }
  };

  const handleDesvincular = async (pessoaId: string) => {
    setProcessando(pessoaId);
    try {
      await aoDesvincular(pessoaId);
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
          aria-label="Vincular pessoa"
          title="Vincular pessoa"
          disabled={!podeEditar}
        >
          <Icone nome="mais" />
        </button>
      </div>

      {pessoasVinculadas.length === 0 ? (
        <p className="text-sm text-ardesia">Nenhuma pessoa vinculada.</p>
      ) : (
        <ul className="divide-y divide-pietra-clara">
          {pessoasVinculadas.map((p) => (
            <li key={p.id} className="py-2 flex items-center justify-between">
              <div>
                <Link
                  to={`/pessoas/${p.id}`}
                  className="font-semibold text-carbone hover:text-verde-escuro"
                >
                  {p.nome}
                </Link>
              </div>
              <button
                onClick={() => handleDesvincular(p.id)}
                disabled={processando === p.id || !podeEditar}
                className="btn btn-perigo btn-pequeno"
                aria-label="Remover pessoa"
                title="Remover pessoa"
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
              <h4 className="text-lg font-semibold text-carbone mb-3">Selecionar Pessoa</h4>

              <div className="input-grupo mb-3">
                <input
                  className="input"
                  placeholder="Buscar por nome..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {pessoasFiltradas.length === 0 ? (
                  <p className="text-sm text-ardesia">
                    {busca ? "Nenhuma pessoa encontrada para esta busca." : "Nenhuma pessoa disponivel para vincular."}
                  </p>
                ) : (
                  <ul className="divide-y divide-pietra-clara">
                    {pessoasFiltradas.map((p) => (
                      <li key={p.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-carbone">{p.nome}</span>
                        </div>
                        <button
                          onClick={() => handleVincular(p.id)}
                          disabled={processando === p.id}
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
