import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useVeiculo, usePessoasVeiculo } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { VeiculoForm } from "../components/VeiculoForm";
import { atualizarVeiculo, excluirVeiculo } from "../lib/veiculos";

export function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sessao } = useSessao();
  const { item: veiculo, carregando, erro } = useVeiculo(id);
  const { itens: pessoas } = usePessoasVeiculo(id);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroOperacao, setErroOperacao] = useState<string | null>(null);

  const podeEditar = sessao?.perfil === "ADM" || sessao?.perfil === "ORG";

  const handleSalvar = async (dados: { fabricante: string; modelo: string; placa: string; cor: string }) => {
    if (!id) return;
    setSalvando(true);
    setErroOperacao(null);
    try {
      await atualizarVeiculo(id, dados);
      await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      setEditando(false);
    } catch (e) {
      setErroOperacao((e as Error).message ?? "Erro ao salvar veiculo.");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!id || !confirm("Tem certeza que deseja excluir este veiculo?")) return;
    setErroOperacao(null);
    try {
      await excluirVeiculo(id);
      await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      navigate("/veiculos");
    } catch (e) {
      setErroOperacao((e as Error).message ?? "Erro ao excluir veiculo.");
    }
  };

  if (carregando) {
    return <div className="text-ardesia">Carregando...</div>;
  }

  if (erro || !veiculo) {
    return (
      <div className="card border-vermelho/40">
        <div className="card-corpo text-vermelho-escuro">{erro ?? "Veiculo nao encontrado."}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/veiculos" className="eyebrow">
            ← Veículos
          </Link>
          <h2 className="mt-1">{veiculo.placa}</h2>
          <p className="text-ardesia text-sm">
            {veiculo.fabricante} {veiculo.modelo} - {veiculo.cor}
          </p>
        </div>
        {podeEditar && (
          <div className="flex gap-2">
            {!editando && (
              <button onClick={() => setEditando(true)} className="btn btn-secundario">
                Editar
              </button>
            )}
            <button onClick={handleExcluir} className="btn btn-perigo">
              Excluir
            </button>
          </div>
        )}
      </header>

      {erroOperacao && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erroOperacao}</div>
        </div>
      )}

      {editando ? (
        <div className="card">
          <div className="card-corpo">
            <VeiculoForm
              veiculo={veiculo}
              aoSalvar={handleSalvar}
              aoCancelar={() => setEditando(false)}
              carregando={salvando}
            />
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-corpo">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-ardesia">Fabricante</dt>
                <dd className="mt-1">{veiculo.fabricante}</dd>
              </div>
              <div>
                <dt className="text-sm text-ardesia">Modelo</dt>
                <dd className="mt-1">{veiculo.modelo}</dd>
              </div>
              <div>
                <dt className="text-sm text-ardesia">Placa</dt>
                <dd className="mt-1 font-mono">{veiculo.placa}</dd>
              </div>
              <div>
                <dt className="text-sm text-ardesia">Cor</dt>
                <dd className="mt-1">{veiculo.cor}</dd>
              </div>
              <div>
                <dt className="text-sm text-ardesia">Estacionamento</dt>
                <dd className="mt-1">
                  {veiculo.estacionamentoId ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-verde/10 text-verde-escuro">
                      Vinculado
                    </span>
                  ) : (
                    <span className="text-ardesia">Nenhum</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ardesia">Criado em</dt>
                <dd className="mt-1">{new Date(veiculo.criadoEm).toLocaleDateString("pt-BR")}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <section className="card">
        <div className="card-corpo">
          <h4 className="mb-3">Pessoas Vinculadas</h4>
          {pessoas.length === 0 ? (
            <p className="text-ardesia text-sm">Nenhuma pessoa vinculada.</p>
          ) : (
            <ul className="divide-y divide-pietra-clara">
              {pessoas.map((p) => (
                <li
                  key={p.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-carbone">{p.nome}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/veiculos")}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
