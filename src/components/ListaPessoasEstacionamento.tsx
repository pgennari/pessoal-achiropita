import { useState } from "react";
import { Link } from "react-router-dom";
import { usePessoas, usePessoasEstacionamento } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { associarPessoaEstacionamento, desassociarPessoaEstacionamento } from "../lib/estacionamentos";
import { Estacionamento } from "../lib/tipos";

interface Props {
  estacionamento: Estacionamento;
}

export function ListaPessoasEstacionamento({ estacionamento }: Props) {
  const { sessao } = useSessao();
  const { itens: pessoasEstacionamento, carregando } = usePessoasEstacionamento(estacionamento.id);
  const { itens: todasPessoas } = usePessoas();
  const [busca, setBusca] = useState("");
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<string | null>(null);

  if (!sessao) return null;
  const podeEditar = sessao.perfil === "ADM" || sessao.perfil === "ORG";

  const pessoasFiltradas = busca.trim()
    ? todasPessoas.filter((p) =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        String(p.cracha).includes(busca)
      )
    : [];

  async function handleAssociar(pessoaId: string) {
    if (!sessao) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await associarPessoaEstacionamento(sessao, estacionamento.id, pessoaId);
      setBusca("");
      setPessoaSelecionada(null);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao associar.");
    } finally {
      setAcaoOcupado(false);
    }
  }

  async function handleDesassociar(pessoaId: string) {
    if (!sessao) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await desassociarPessoaEstacionamento(sessao, estacionamento.id, pessoaId);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao desassociar.");
    } finally {
      setAcaoOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-carbone">Pessoas Associadas</h4>
        <span className="text-sm text-ardesia">
          {pessoasEstacionamento.length} de {estacionamento.vagasContratadas} vagas
        </span>
      </div>

      {acaoErro && (
        <div className="text-sm text-vermelho-escuro">{acaoErro}</div>
      )}

      {podeEditar && (
        <div className="space-y-2">
          <input
            type="text"
            className="input"
            placeholder="Buscar pessoa por nome ou cracha..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPessoaSelecionada(null);
            }}
          />
          {pessoasFiltradas.length > 0 && (
            <div className="border border-pietra-clara rounded-lg max-h-48 overflow-y-auto">
              {pessoasFiltradas.slice(0, 10).map((p) => (
                <div
                  key={p.id}
                  className={`px-3 py-2 cursor-pointer hover:bg-pietra-clara/40 flex items-center justify-between ${
                    pessoaSelecionada === p.id ? "bg-azul-claro/20" : ""
                  }`}
                  onClick={() => setPessoaSelecionada(p.id)}
                >
                  <div>
                    <div className="font-semibold text-carbone">{p.nome}</div>
                    <div className="text-xs text-ardesia font-mono">#{p.cracha}</div>
                  </div>
                  {pessoaSelecionada === p.id && (
                    <button
                      type="button"
                      className="btn btn-primario"
                      onClick={() => handleAssociar(p.id)}
                      disabled={acaoOcupado}
                    >
                      {acaoOcupado ? "Associando..." : "Associar"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {carregando ? (
        <p className="text-ardesia text-sm">Carregando...</p>
      ) : pessoasEstacionamento.length === 0 ? (
        <p className="text-ardesia text-sm">Nenhuma pessoa associada.</p>
      ) : (
        <ul className="divide-y divide-pietra-clara">
          {pessoasEstacionamento.map((p) => (
            <li
              key={p.id}
              className="py-3 flex items-center justify-between gap-3"
            >
              <Link
                to={`/pessoas/${p.id}`}
                className="hover:underline"
              >
                <div className="font-semibold text-carbone">{p.nome}</div>
                <div className="text-xs text-ardesia font-mono">#{p.cracha}</div>
              </Link>
              {podeEditar && (
                <button
                  type="button"
                  className="text-xs text-vermelho-escuro hover:underline"
                  onClick={() => handleDesassociar(p.id)}
                  disabled={acaoOcupado}
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}