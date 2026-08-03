import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useEstacionamentos } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { associarPessoaEstacionamento, desassociarPessoaEstacionamento } from "../lib/estacionamentos";
import { Pessoa } from "../lib/tipos";
import { Icone } from "./Icone";

interface Props {
  pessoa: Pessoa;
}

export function EstacionamentoPessoa({ pessoa }: Props) {
  const { sessao } = useSessao();
  const { itens: estacionamentos } = useEstacionamentos();
  const estacionamentosOrdenados = useMemo(
    () => [...estacionamentos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [estacionamentos]
  );
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

  return (
    <div className="border border-pietra-clara rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-carbone">Estacionamento</h3>
        {podeEditar && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="btn btn-secundario btn-pequeno"
            aria-label="Associar estacionamento"
            title="Associar estacionamento"
          >
            <Icone nome="mais" />
          </button>
        )}
      </div>

      {editando ? (
        <div className="space-y-3">
          {acaoErro && (
            <div className="rounded-sm bg-vermelho/10 border border-vermelho/30 p-3 text-sm text-vermelho-escuro">
              {acaoErro}
            </div>
          )}
          <select
            className="input"
            value={estacionamentoSelecionado}
            onChange={(e) => setEstacionamentoSelecionado(e.target.value)}
          >
            <option value="">Nenhum</option>
            {estacionamentosOrdenados.map((est) => (
              <option key={est.id} value={est.id}>
                {est.nome}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primario"
              onClick={handleSalvar}
              disabled={acaoOcupado}
              aria-label="Salvar"
              title="Salvar"
            >
              <Icone nome="check" />
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => {
                setEditando(false);
                setEstacionamentoSelecionado(pessoa.estacionamentoId ?? "");
              }}
              disabled={acaoOcupado}
              aria-label="Cancelar"
              title="Cancelar"
            >
              <Icone nome="fechar" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          {pessoa.estacionamentoId && pessoa.estacionamentoNome ? (
            <div className="flex items-center justify-between">
              <Link
                to={`/estacionamentos/${pessoa.estacionamentoId}`}
                className="font-semibold text-carbone hover:text-verde-escuro"
              >
                {pessoa.estacionamentoNome}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ardesia">Nenhum estacionamento associado.</p>
          )}
        </div>
      )}
    </div>
  );
}
