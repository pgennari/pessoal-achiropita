// ============================================================================
// CONTROLE DE PERMISSAO
// Editar: permissao "pessoas.editar" (ou o proprio registro).
// Inativar: permissao "pessoas.ativar". Excluir: permissao "pessoas.excluir".
// Dados sensiveis: perfil ADM.
// ============================================================================
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PessoaForm } from "../components/PessoaForm";
import { UploadFoto } from "../components/UploadFoto";
import { HistoricoPessoa } from "../components/HistoricoPessoa";
import { HistoricoEquipesPessoa } from "../components/HistoricoEquipesPessoa";
import { HistoricoPresencaPessoa } from "../components/HistoricoPresencaPessoa";
import { EditarFilhos } from "../components/EditarFilhos";
import { EditarParentes } from "../components/EditarParentes";
import { VinculoVeiculo } from "../components/VinculoVeiculo";
import { Icone } from "../components/Icone";
import { usePessoa, usePessoas, useVeiculos, useVeiculosPessoa, useParentes, useAvaliacoesPessoa } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  DadosPessoaForm,
  atualizarPessoa,
  definirAtivacao,
  excluirPessoa,
} from "../lib/pessoas";
import { adicionarParente, removerParente } from "../lib/parentes";
import {
  vincularVeiculoPessoa,
  desvincularVeiculoPessoa,
  criarVeiculo,
} from "../lib/veiculos";
import { calcularIdade, formatarCPF, formatarData } from "../lib/utilsDominio";

export function PessoaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sessao } = useSessao();
  const { item: pessoa, carregando, erro } = usePessoa(id);
  const { itens } = usePessoas();
  const { itens: veiculos } = useVeiculos();
  const { itens: veiculosPessoa } = useVeiculosPessoa(id);
  const { itens: parentes } = useParentes(id);
  const [editando, setEditando] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [searchParams] = useSearchParams();
  const [abaCadastro, setAbaCadastro] = useState<"foto" | "dados" | "filhos" | "veiculos" | "parentes">("dados");
  const historicoInicial = searchParams.get("aba") === "avaliacoes" ? "avaliacoes" as const : "presenca" as const;
  const [abaHistorico, setAbaHistorico] = useState<
    "movimentacao" | "participacoes" | "presenca" | "avaliacoes"
  >(historicoInicial);
  const { itens: avaliacoesPessoa } = useAvaliacoesPessoa(id);

  const coresCriterio: Record<string, string> = {
    Otimo: "#16a34a",
    Bom: "#2563eb",
    Regular: "#ca8a04",
    Ruim: "#dc2626",
  };

  const rotulosCriterio: Record<string, string> = {
    pontualidade: "Pontualidade",
    dedicacao: "Dedicação",
    companheirismo: "Companheirismo",
    espiritualidade: "Espiritualidade",
    comprometimento: "Comprometimento",
    uniforme: "Uniforme",
    convidarNovamente: "Convidaria novamente",
  };

  if (!sessao) return null;
  const ehProprio = !!sessao.pessoaId && sessao.pessoaId === id;
  const podeEditar = temPermissao(sessao, "pessoas.editar") || ehProprio;
  const podeInativar = temPermissao(sessao, "pessoas.ativar");
  const podeExcluir = temPermissao(sessao, "pessoas.excluir");
  const bloquearSensivel = sessao.perfil !== "ADM";
  const podeVerExclusivo = temPermissao(sessao, "exclusivoPessoal");

  if (carregando) {
    return <p className="text-ardesia">Carregando...</p>;
  }

  if (erro || !pessoa) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Pessoa não encontrada</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
          <Link
            to="/pessoas"
            className="btn btn-secundario mt-4"
            aria-label="Voltar"
            title="Voltar"
          >
            <Icone nome="seta-esquerda" />
          </Link>
        </div>
      </div>
    );
  }

  async function handleSalvar(dados: DadosPessoaForm) {
    if (!sessao || !pessoa) return;
    await atualizarPessoa(sessao, pessoa.id, dados, itens, {
      checarFilhosCarros: false,
    });
    setEditando(false);
  }

  async function handleAtivacao(ativar: boolean) {
    if (!sessao || !pessoa) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await definirAtivacao(sessao, pessoa, ativar);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setAcaoOcupado(false);
    }
  }

  async function handleExcluir() {
    if (!sessao || !pessoa) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await excluirPessoa(sessao, pessoa);
      navigate("/pessoas");
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao excluir.");
      setConfirmandoExclusao(false);
      setAcaoOcupado(false);
    }
  }

  const idade = calcularIdade(pessoa.nascimento);

  if (editando) {
    return (
      <div className="space-y-6 max-w-3xl">
        <header>
          <div className="eyebrow">Editando</div>
          <h2 className="mt-1">{pessoa.nome}</h2>
          <p className="text-ardesia text-sm font-mono">
            Crachá #{pessoa.cracha}
          </p>
        </header>

        <div className="card">
          <div className="card-corpo">
            <PessoaForm
              inicial={pessoa}
              onSubmit={handleSalvar}
              onCancelar={() => setEditando(false)}
              bloquearSensivel={bloquearSensivel}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/pessoas" className="eyebrow">
            ← Pessoas
          </Link>
          <h2 className="mt-1">{pessoa.nome}</h2>
          <div className="text-ardesia text-sm flex flex-wrap items-center gap-2">
            <span className="font-mono">#{pessoa.cracha}</span>
            <span>·</span>
            {pessoa.ativo ? (
              <span className="badge badge-verde">ativo</span>
            ) : (
              <span className="badge badge-cinza">inativo</span>
            )}
            {ehProprio && (
              <span className="badge badge-azul">sua ficha</span>
            )}
          </div>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setEditando(true)}
              aria-label="Editar"
              title="Editar"
            >
              <Icone nome="lapis" />
            </button>
            {podeInativar &&
              (pessoa.ativo ? (
                <button
                  type="button"
                  className="btn btn-perigo"
                  onClick={() => handleAtivacao(false)}
                  disabled={acaoOcupado}
                  aria-label="Inativar"
                  title="Inativar"
                >
                  <Icone nome="usuario-x" />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={() => handleAtivacao(true)}
                  disabled={acaoOcupado}
                  aria-label="Reativar"
                  title="Reativar"
                >
                  <Icone nome="check" />
                </button>
              ))}
            {podeExcluir && !confirmandoExclusao && (
              <button
                type="button"
                className="btn btn-perigo"
                onClick={() => setConfirmandoExclusao(true)}
                disabled={acaoOcupado}
                aria-label="Excluir"
                title="Excluir"
              >
                <Icone nome="lixeira" />
              </button>
            )}
          </div>
        )}
      </header>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      {confirmandoExclusao && (
        <div className="card border-vermelho/40">
          <div className="card-corpo space-y-3">
            <p className="font-semibold text-vermelho-escuro">
              Excluir {pessoa.nome} definitivamente?
            </p>
            <p className="text-sm text-ardesia">
              Esta acao e irreversivel. O cadastro, a foto e o cracha #{pessoa.cracha}
              serao removidos permanentemente. O evento ficara registrado na auditoria.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-perigo"
                onClick={handleExcluir}
                disabled={acaoOcupado}
                aria-label="Confirmar exclusao"
                title="Confirmar exclusao"
              >
                <Icone nome="lixeira" />
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setConfirmandoExclusao(false)}
                disabled={acaoOcupado}
                aria-label="Cancelar"
                title="Cancelar"
              >
                <Icone nome="fechar" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Cadastro da pessoa">
        <div className="tabs-lista">
          <button
            type="button"
            role="tab"
            aria-selected={abaCadastro === "foto"}
            className={`aba ${abaCadastro === "foto" ? "aba-ativa" : ""}`}
            onClick={() => setAbaCadastro("foto")}
          >
            Foto
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaCadastro === "dados"}
            className={`aba ${abaCadastro === "dados" ? "aba-ativa" : ""}`}
            onClick={() => setAbaCadastro("dados")}
          >
            Dados
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaCadastro === "filhos"}
            className={`aba ${abaCadastro === "filhos" ? "aba-ativa" : ""}`}
            onClick={() => setAbaCadastro("filhos")}
          >
            Filhos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaCadastro === "veiculos"}
            className={`aba ${abaCadastro === "veiculos" ? "aba-ativa" : ""}`}
            onClick={() => setAbaCadastro("veiculos")}
          >
            Veículos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaCadastro === "parentes"}
            className={`aba ${abaCadastro === "parentes" ? "aba-ativa" : ""}`}
            onClick={() => setAbaCadastro("parentes")}
          >
            Parentes
          </button>
        </div>

        {abaCadastro === "foto" && (
          <div className="tabs-painel" role="tabpanel" tabIndex={0}>
            <UploadFoto sessao={sessao} pessoa={pessoa} podeEditar={podeEditar} />
          </div>
        )}

        {abaCadastro === "dados" && (
          <div className="tabs-painel" role="tabpanel" tabIndex={0}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Linha
                rotulo="Nascimento"
                valor={`${formatarData(pessoa.nascimento)}${
                  idade !== null ? ` · ${idade} anos` : ""
                }`}
              />
              <Linha rotulo="Estado civil" valor={pessoa.estadoCivil ?? "—"} />
              <Linha
                rotulo="Tamanho de camiseta"
                valor={pessoa.tamanhoCamiseta ?? "—"}
              />
              <Linha rotulo="Telefone" valor={pessoa.telefone || "—"} />
              <Linha rotulo="E-mail" valor={pessoa.email ?? "—"} />
              <Linha
                rotulo="CPF"
                valor={pessoa.cpf ? formatarCPF(pessoa.cpf) : "—"}
              />
              <Linha rotulo="RG" valor={pessoa.rg ?? "—"} />
              <Linha rotulo="Endereço" valor={pessoa.endereco ?? "—"} />
              <Linha rotulo="Bairro" valor={pessoa.bairro ?? "—"} />
              <Linha
                rotulo="Vaga de estacionamento"
                valor={pessoa.vagaIdentificacao ?? "—"}
              />
              <Linha
                rotulo="Estacionamento"
                valor={pessoa.estacionamentoNome ?? "—"}
              />
            </div>
          </div>
        )}

        {abaCadastro === "filhos" && (
          <div className="tabs-painel" role="tabpanel" tabIndex={0}>
            <EditarFilhos
              pessoa={pessoa}
              sessao={sessao}
              pessoas={itens}
              podeEditar={podeEditar}
            />
          </div>
        )}

        {abaCadastro === "veiculos" && (
          <div className="tabs-painel" role="tabpanel" tabIndex={0}>
            <VinculoVeiculo
              titulo="Veículos vinculados"
              veiculosDisponiveis={veiculos.filter(
                (v) => !veiculosPessoa.some((vp) => vp.id === v.id)
              )}
              veiculosVinculados={veiculosPessoa}
              aoVincular={async (veiculoId) => {
                await vincularVeiculoPessoa(id!, veiculoId);
                await queryClient.invalidateQueries({ queryKey: ["pessoas", id, "veiculos"] });
                await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
              }}
              aoDesvincular={async (veiculoId) => {
                await desvincularVeiculoPessoa(id!, veiculoId);
                await queryClient.invalidateQueries({ queryKey: ["pessoas", id, "veiculos"] });
                await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
              }}
              aoCriar={async (dados) => {
                const veiculo = await criarVeiculo(dados);
                await vincularVeiculoPessoa(id!, veiculo.id);
                await queryClient.invalidateQueries({ queryKey: ["pessoas", id, "veiculos"] });
                await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
              }}
              podeCriar={temPermissao(sessao, "veiculos.incluir")}
            />
          </div>
        )}

        {abaCadastro === "parentes" && (
          <div className="tabs-painel" role="tabpanel" tabIndex={0}>
            <EditarParentes
              pessoa={pessoa}
              pessoas={itens}
              parentes={parentes}
              podeEditar={temPermissao(sessao, "pessoas.parentes")}
              aoAdicionar={async (parenteId, parentesco) => {
                await adicionarParente(id!, parenteId, parentesco);
              }}
              aoRemover={async (parenteId) => {
                await removerParente(id!, parenteId);
              }}
            />
          </div>
        )}
      </div>

      {podeVerExclusivo && (
            <div className="tabs" role="tablist" aria-label="Históricos da pessoa">
              <div className="px-4 pt-4 pb-1">
                <h4 className="m-0">Exclusivo Pessoal</h4>
              </div>
              <div className="tabs-lista">
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaHistorico === "presenca"}
                  className={`aba ${abaHistorico === "presenca" ? "aba-ativa" : ""}`}
                  onClick={() => setAbaHistorico("presenca")}
                >
                  Histórico de presença
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaHistorico === "movimentacao"}
                  className={`aba ${abaHistorico === "movimentacao" ? "aba-ativa" : ""}`}
                  onClick={() => setAbaHistorico("movimentacao")}
                >
                  Histórico movimentação
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaHistorico === "participacoes"}
                  className={`aba ${abaHistorico === "participacoes" ? "aba-ativa" : ""}`}
                  onClick={() => setAbaHistorico("participacoes")}
                >
                  Histórico participações
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaHistorico === "avaliacoes"}
                  className={`aba ${abaHistorico === "avaliacoes" ? "aba-ativa" : ""}`}
                  onClick={() => setAbaHistorico("avaliacoes")}
                >
                  Histórico de avaliações
                </button>
              </div>

              {abaHistorico === "presenca" && (
                <div className="tabs-painel" role="tabpanel" tabIndex={0}>
                  <HistoricoPresencaPessoa pessoaId={pessoa.id} sessao={sessao} />
                </div>
              )}

              {abaHistorico === "movimentacao" && (
                <div className="tabs-painel" role="tabpanel" tabIndex={0}>
                  <HistoricoEquipesPessoa pessoaId={pessoa.id} />
                </div>
              )}

              {abaHistorico === "participacoes" && (
                <div className="tabs-painel" role="tabpanel" tabIndex={0}>
                  <HistoricoPessoa pessoa={pessoa} />
                </div>
              )}

              {abaHistorico === "avaliacoes" && (
                <div className="tabs-painel" role="tabpanel" tabIndex={0}>
                  {avaliacoesPessoa.length === 0 ? (
                    <p className="text-sm text-ardesia">Nenhuma avaliação registrada para esta pessoa.</p>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-ardesia">
                        {avaliacoesPessoa.length} avaliação(ões) registrada(s)
                      </p>
                      <div className="card">
                        <div className="card-corpo divide-y divide-pietra-clara">
                          {avaliacoesPessoa.map((a) => (
                            <div key={a.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-carbone">
                                  {(a as any).edicaoNumero ?? a.edicaoId}ª edição
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-ardesia font-mono">
                                    {new Date(a.atualizadoEm).toLocaleString("pt-BR")}
                                  </span>
                                  <span className={`badge ${a.status === "finalizada" ? "badge-verde" : "badge-azul"}`}>
                                    {a.status === "finalizada" ? "Finalizada" : "Rascunho"}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-ardesia">
                                Equipe {(a as any).equipeNome ?? "—"} · Avaliador: {a.avaliadorNome}
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                                {Object.entries(a.criterios).map(([k, v]) => (
                                  <div key={k} className="flex justify-between">
                                    <span className="text-ardesia">
                                      {rotulosCriterio[k] ?? k}
                                    </span>
                                    <span
                                      className="font-semibold"
                                      style={{
                                        color:
                                          typeof v === "number"
                                            ? undefined
                                            : coresCriterio[v as string] ??
                                              undefined,
                                      }}
                                    >
                                      {typeof v === "number"
                                        ? `${v}/5`
                                        : ((v as string) ?? "—")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-ardesia">
                                <span>
                                  Apto a coordenar: <strong className="text-carbone">{a.aptoCoordenar ? "Sim" : "Não"}</strong>
                                </span>
                              </div>
                              {a.comentarios && (
                                <p className="text-xs text-ardesia italic border-t border-pietra-clara pt-2">
                                  {a.comentarios}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
      )}

      {pessoa.atualizadoEm && (
        <p className="text-xs text-ardesia font-mono">
          Atualizado em {formatarData(pessoa.atualizadoEm)}
        </p>
      )}

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/pessoas")}
          aria-label="Voltar"
          title="Voltar"
        >
          <Icone nome="seta-esquerda" />
        </button>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ardesia font-mono">
        {rotulo}
      </div>
      <div className="text-carbone">{valor}</div>
    </div>
  );
}
