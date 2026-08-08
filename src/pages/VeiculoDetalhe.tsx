// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado.
// Editar: veiculos.editar. Associar estacionamento: estacionamento.associar.
// Vincular pessoa: veiculos.vincular. Excluir: veiculos.excluir.
// ============================================================================
import { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useVeiculo, usePessoasVeiculo, useEstacionamentos, usePessoas, useHistoricoEstacionamentosVeiculo } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { VeiculoForm } from "../components/VeiculoForm";
import { atualizarVeiculo, excluirVeiculo, associarVeiculoEstacionamento, desassociarVeiculoEstacionamento, vincularPessoaVeiculo, desvincularPessoaVeiculo, type DadosVeiculo } from "../lib/veiculos";
import { VinculoPessoa } from "../components/VinculoPessoa";
import type { HistoricoEstacionamentoVeiculo } from "../lib/tipos";
import { Icone } from "../components/Icone";

export function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sessao } = useSessao();
  const { item: veiculo, carregando, erro } = useVeiculo(id);
  const { itens: pessoas } = usePessoasVeiculo(id);
  const { itens: estacionamentos } = useEstacionamentos();
  const { itens: todasPessoas } = usePessoas();
  const { itens: historico, carregando: historicoCarregando } = useHistoricoEstacionamentosVeiculo(id);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editandoEstacionamento, setEditandoEstacionamento] = useState(false);
  const [estacionamentoSelecionado, setEstacionamentoSelecionado] = useState("");
  const [editandoObservacao, setEditandoObservacao] = useState(false);
  const [observacaoTexto, setObservacaoTexto] = useState("");
  const [erroOperacao, setErroOperacao] = useState<string | null>(null);

  const podeEditar = temPermissao(sessao, "veiculos.editar");
  const podeAssociar = temPermissao(sessao, "estacionamento.associar");
  const podeVincular = temPermissao(sessao, "veiculos.vincular");
  const podeExcluir = temPermissao(sessao, "veiculos.excluir");

  const estacionamentoAtual = useMemo(
    () => estacionamentos.find((e) => e.id === veiculo?.estacionamentoId),
    [estacionamentos, veiculo?.estacionamentoId]
  );

  const estacionamentosOrdenados = useMemo(
    () => [...estacionamentos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [estacionamentos]
  );

  const estacionamentosPorId = useMemo(() => {
    const m = new Map<string, { nome: string }>();
    for (const e of estacionamentos) m.set(e.id, { nome: e.nome });
    return m;
  }, [estacionamentos]);

  const pessoasDisponiveis = useMemo(
    () => todasPessoas.filter((p) => !pessoas.some((vp) => vp.id === p.id)),
    [todasPessoas, pessoas]
  );

  const handleVincularPessoa = async (pessoaId: string) => {
    if (!id) return;
    await vincularPessoaVeiculo(id, pessoaId);
    await queryClient.invalidateQueries({ queryKey: ["veiculos", id, "pessoas"] });
  };

  const handleDesvincularPessoa = async (pessoaId: string) => {
    if (!id) return;
    await desvincularPessoaVeiculo(id, pessoaId);
    await queryClient.invalidateQueries({ queryKey: ["veiculos", id, "pessoas"] });
  };

  const handleSalvar = async (dados: DadosVeiculo) => {
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

  const handleAlternarCrachaCarro = async () => {
    if (!id || !veiculo) return;
    setErroOperacao(null);
    try {
      await atualizarVeiculo(id, {
        fabricante: veiculo.fabricante ?? "",
        modelo: veiculo.modelo ?? "",
        placa: veiculo.placa,
        cor: veiculo.cor ?? "",
        observacao: veiculo.observacao ?? "",
        crachaCarroImpresso: !veiculo.crachaCarroImpresso,
      });
      await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      await queryClient.invalidateQueries({ queryKey: ["veiculos", id] });
    } catch (e) {
      setErroOperacao((e as Error).message ?? "Erro ao atualizar cracha do carro.");
    }
  };

  const handleSalvarObservacao = async () => {
    if (!id || !veiculo) return;
    setSalvando(true);
    setErroOperacao(null);
    try {
      await atualizarVeiculo(id, {
        fabricante: veiculo.fabricante ?? "",
        modelo: veiculo.modelo ?? "",
        placa: veiculo.placa,
        cor: veiculo.cor ?? "",
        observacao: observacaoTexto.trim(),
        crachaCarroImpresso: !!veiculo.crachaCarroImpresso,
      });
      await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      await queryClient.invalidateQueries({ queryKey: ["veiculos", id] });
      setEditandoObservacao(false);
    } catch (e) {
      setErroOperacao((e as Error).message ?? "Erro ao salvar observacao.");
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

  const handleSalvarEstacionamento = async () => {
    if (!id || !veiculo) return;
    setErroOperacao(null);
    try {
      if (estacionamentoSelecionado && estacionamentoSelecionado !== veiculo.estacionamentoId) {
        if (veiculo.estacionamentoId) {
          await desassociarVeiculoEstacionamento(veiculo.estacionamentoId, id);
        }
        await associarVeiculoEstacionamento(estacionamentoSelecionado, id);
      } else if (!estacionamentoSelecionado && veiculo.estacionamentoId) {
        await desassociarVeiculoEstacionamento(veiculo.estacionamentoId, id);
      }
      setEditandoEstacionamento(false);
    } catch (e) {
      setErroOperacao((e as Error).message ?? "Erro ao salvar estacionamento.");
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
        {podeEditar && !editando && (
          <button
            onClick={() => setEditando(true)}
            className="btn btn-secundario"
            aria-label="Editar"
            title="Editar"
          >
            <Icone nome="lapis" />
          </button>
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
                <dt className="text-sm text-ardesia">Criado em</dt>
                <dd className="mt-1">{new Date(veiculo.criadoEm).toLocaleDateString("pt-BR")}</dd>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-sm text-ardesia">Observacao</dt>
                  {podeEditar && !editandoObservacao && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-verde hover:underline"
                      onClick={() => {
                        setObservacaoTexto(veiculo.observacao ?? "");
                        setEditandoObservacao(true);
                      }}
                    >
                      Editar
                    </button>
                  )}
                </div>
                {editandoObservacao ? (
                  <div className="mt-1 space-y-2">
                    <textarea
                      className="input min-h-[96px]"
                      value={observacaoTexto}
                      onChange={(e) => setObservacaoTexto(e.target.value)}
                      placeholder="Ex: Pediu vaga fora do perímetro da festa"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-primario"
                        onClick={handleSalvarObservacao}
                        disabled={salvando}
                        aria-label="Salvar"
                        title="Salvar"
                      >
                        <Icone nome="check" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario"
                        onClick={() => setEditandoObservacao(false)}
                        disabled={salvando}
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <Icone nome="fechar" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <dd className="mt-1 whitespace-pre-wrap">{veiculo.observacao || "—"}</dd>
                )}
              </div>
              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={!!veiculo.crachaCarroImpresso}
                    disabled={!podeEditar}
                    onChange={handleAlternarCrachaCarro}
                  />
                  <span className="font-sans font-semibold text-carbone">
                    Crachá do carro impresso
                  </span>
                </label>
              </div>
            </dl>
          </div>
        </div>
      )}

      <div className="border border-pietra-clara rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-carbone">Estacionamento</h3>
          {podeAssociar && !editando && !editandoEstacionamento && (
            <button
              type="button"
              onClick={() => {
                setEstacionamentoSelecionado(veiculo.estacionamentoId ?? "");
                setEditandoEstacionamento(true);
              }}
              className="btn btn-secundario btn-pequeno"
              aria-label="Alterar estacionamento"
              title="Alterar estacionamento"
            >
              <Icone nome="mais" />
            </button>
          )}
        </div>

        {editandoEstacionamento ? (
          <div className="space-y-3">
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
                onClick={handleSalvarEstacionamento}
                aria-label="Salvar"
                title="Salvar"
              >
                <Icone nome="check" />
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => {
                  setEditandoEstacionamento(false);
                  setEstacionamentoSelecionado(veiculo.estacionamentoId ?? "");
                }}
                aria-label="Cancelar"
                title="Cancelar"
              >
                <Icone nome="fechar" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            {estacionamentoAtual ? (
              <Link
                to={`/estacionamentos/${estacionamentoAtual.id}`}
                className="font-semibold text-carbone hover:text-verde-escuro"
              >
                {estacionamentoAtual.nome}
              </Link>
            ) : (
              <p className="text-sm text-ardesia">Nenhum estacionamento associado.</p>
            )}
          </div>
        )}
      </div>

      <div className="border border-pietra-clara rounded-lg p-4">
        <h3 className="text-lg font-semibold text-carbone mb-3">
          Historico de associação
        </h3>
        {historicoCarregando ? (
          <p className="text-sm text-ardesia">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-ardesia">
            Nenhuma alteracao de estacionamento registrada.
          </p>
        ) : (
          <ul className="divide-y divide-pietra-clara">
            {historico.map((h) => (
              <li key={h.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-carbone">
                    {rotuloOperacao(h.operacao)}
                  </span>
                  <span className="text-xs text-ardesia">
                    {formatarDataHora(h.criadoEm)}
                  </span>
                </div>
                <div className="text-sm text-ardesia mt-0.5">
                  <EstacionamentoHistorico nome={h.estacionamentoNome} estacionamentoId={h.estacionamentoId} estacionamentosPorId={estacionamentosPorId} />
                </div>
                <div className="text-xs text-ardesia mt-0.5">
                  por {h.autorNome}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="card">
        <div className="card-corpo">
          <VinculoPessoa
            titulo="Pessoas Vinculadas"
            pessoasDisponiveis={pessoasDisponiveis}
            pessoasVinculadas={pessoas}
            aoVincular={handleVincularPessoa}
            aoDesvincular={handleDesvincularPessoa}
            podeEditar={podeVincular}
          />
        </div>
      </section>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/veiculos")}
          aria-label="Voltar"
          title="Voltar"
        >
          <Icone nome="seta-esquerda" />
        </button>
        {podeExcluir && (
          <button
            onClick={handleExcluir}
            className="btn btn-perigo"
            aria-label="Excluir"
            title="Excluir"
          >
            <Icone nome="lixeira" />
          </button>
        )}
      </div>
    </div>
  );
}

function rotuloOperacao(operacao: HistoricoEstacionamentoVeiculo["operacao"]): string {
  switch (operacao) {
    case "associou":
      return "Associado a";
    case "transferiu":
      return "Transferido para";
    case "desassociou":
      return "Desassociado de";
    default:
      return operacao;
  }
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function EstacionamentoHistorico({
  nome,
  estacionamentoId,
  estacionamentosPorId,
}: {
  nome: string;
  estacionamentoId?: string;
  estacionamentosPorId: Map<string, { nome: string }>;
}) {
  if (estacionamentoId && estacionamentosPorId.has(estacionamentoId)) {
    return (
      <Link
        to={`/estacionamentos/${estacionamentoId}`}
        className="font-medium text-carbone hover:text-verde-escuro"
      >
        {nome}
      </Link>
    );
  }
  return <span className="font-medium text-carbone">{nome}</span>;
}
