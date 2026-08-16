// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado.
// Editar: veiculos.editar. Vincular pessoa: veiculos.vincular. Excluir: veiculos.excluir.
// Estacionamentos exibidos sao derivados das vagas das pessoas vinculadas (FR-010).
// ============================================================================
import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useVeiculo, usePessoasVeiculo, usePessoas } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { VeiculoForm } from "../components/VeiculoForm";
import { atualizarVeiculo, excluirVeiculo, vincularPessoaVeiculo, desvincularPessoaVeiculo, type DadosVeiculo } from "../lib/veiculos";
import { VinculoPessoa } from "../components/VinculoPessoa";
import { Icone } from "../components/Icone";

function invalidarDadosVeiculo(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: ["veiculos"] });
  queryClient.invalidateQueries({ queryKey: ["veiculos", id] });
  queryClient.invalidateQueries({ queryKey: ["veiculos", id, "pessoas"] });
  queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === "pessoas" && q.queryKey[2] === "veiculos",
  });
}

export function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sessao } = useSessao();
  const { item: veiculo, carregando, erro } = useVeiculo(id);
  const { itens: pessoas } = usePessoasVeiculo(id);
  const { itens: todasPessoas } = usePessoas();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editandoObservacao, setEditandoObservacao] = useState(false);
  const [observacaoTexto, setObservacaoTexto] = useState("");
  const [erroOperacao, setErroOperacao] = useState<string | null>(null);

  const podeEditar = temPermissao(sessao, "veiculos.editar");
  const podeVincular = temPermissao(sessao, "veiculos.vincular");
  const podeExcluir = temPermissao(sessao, "veiculos.excluir");

  const pessoasDisponiveis = todasPessoas.filter((p) => !pessoas.some((vp) => vp.id === p.id));

  const handleVincularPessoa = async (pessoaId: string) => {
    if (!id) return;
    await vincularPessoaVeiculo(id, pessoaId);
    await invalidarDadosVeiculo(queryClient, id);
  };

  const handleDesvincularPessoa = async (pessoaId: string) => {
    if (!id) return;
    await desvincularPessoaVeiculo(id, pessoaId);
    await invalidarDadosVeiculo(queryClient, id);
  };

  const handleSalvar = async (dados: DadosVeiculo) => {
    if (!id) return;
    setSalvando(true);
    setErroOperacao(null);
    try {
      await atualizarVeiculo(id, dados);
      await invalidarDadosVeiculo(queryClient, id);
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
      await invalidarDadosVeiculo(queryClient, id);
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
      await invalidarDadosVeiculo(queryClient, id);
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
      await invalidarDadosVeiculo(queryClient, id);
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
        <h3 className="text-lg font-semibold text-carbone mb-3">Estacionamento</h3>
        {veiculo.estacionamentos && veiculo.estacionamentos.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {veiculo.estacionamentos.map((e) => (
              <Link
                key={e.id}
                to={`/estacionamentos/${e.id}`}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-verde/10 text-verde-escuro hover:bg-verde/20"
              >
                {e.nome}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ardesia">
            Nenhum estacionamento derivado das vagas das pessoas vinculadas.
          </p>
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
