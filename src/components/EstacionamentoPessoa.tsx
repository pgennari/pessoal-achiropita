import { useState } from "react";
import { Link } from "react-router-dom";
import { useEstacionamentos } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { associarPessoaEstacionamento, desassociarPessoaEstacionamento } from "../lib/estacionamentos";
import { Pessoa } from "../lib/tipos";

interface Props {
  pessoa: Pessoa;
}

export function EstacionamentoPessoa({ pessoa }: Props) {
  const { sessao } = useSessao();
  const { itens: estacionamentos } = useEstacionamentos();
  const [editando, setEditando] = useState(false);
  const [estacionamentoSelecionado, setEstacionamentoSelecionado] = useState(pessoa.estacionamentoId ?? "");
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  if (!sessao) return null;
  const podeEditar = sessao.perfil === "ADM" || sessao.perfil === "ORG";

  async function handleSalvar() {
    if (!sessao || !pessoa) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      if (estacionamentoSelecionado && estacionamentoSelecionado !== pessoa.estacionamentoId) {
        if (pessoa.estacionamentoId) {
          await desassociarPessoaEstacionamento(sessao, pessoa.estacionamentoId, pessoa.id);
        }
        await associarPessoaEstacionamento(sessao, estacionamentoSelecionado, pessoa.id);
      } else if (!estacionamentoSelecionado && pessoa.estacionamentoId) {
        await desassociarPessoaEstacionamento(sessao, pessoa.estacionamentoId, pessoa.id);
      }
      setEditando(false);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setAcaoOcupado(false);
    }
  }

  if (editando) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-carbone">Estacionamento</h4>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primario"
              onClick={handleSalvar}
              disabled={acaoOcupado}
            >
              {acaoOcupado ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => {
                setEditando(false);
                setEstacionamentoSelecionado(pessoa.estacionamentoId ?? "");
              }}
              disabled={acaoOcupado}
            >
              Cancelar
            </button>
          </div>
        </div>
        {acaoErro && (
          <div className="text-sm text-vermelho-escuro">{acaoErro}</div>
        )}
        <select
          className="input"
          value={estacionamentoSelecionado}
          onChange={(e) => setEstacionamentoSelecionado(e.target.value)}
        >
          <option value="">Nenhum</option>
          {estacionamentos.map((est) => (
            <option key={est.id} value={est.id}>
              {est.nome}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <h4 className="font-semibold text-carbone">Estacionamento</h4>
      {pessoa.estacionamentoId && pessoa.estacionamentoNome ? (
        <div className="flex items-center gap-2">
          <Link
            to={`/estacionamentos/${pessoa.estacionamentoId}`}
            className="text-azul-escuro hover:underline"
          >
            {pessoa.estacionamentoNome}
          </Link>
          {podeEditar && (
            <button
              type="button"
              className="text-xs text-ardesia hover:text-carbone"
              onClick={() => setEditando(true)}
            >
              Alterar
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-ardesia">Nenhum</span>
          {podeEditar && (
            <button
              type="button"
              className="text-xs text-azul-escuro hover:underline"
              onClick={() => setEditando(true)}
            >
              Associar
            </button>
          )}
        </div>
      )}
    </div>
  );
}