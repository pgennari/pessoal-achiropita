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
import { HistoricoBloqueiosPessoa } from "../components/HistoricoBloqueiosPessoa";
import { EditarFilhos } from "../components/EditarFilhos";
import { EditarParentes } from "../components/EditarParentes";
import { VinculoVeiculo } from "../components/VinculoVeiculo";
import { Icone } from "../components/Icone";
import { usePessoa, usePessoas, useVeiculos, useVeiculosPessoa, useParentes, useAvaliacoesPessoa, useAvaliacoesCoordenadorPessoa, useAvaliacoesEquipistaCoordenadorPessoa } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  Avaliacao,
  AvaliacaoCoordenador,
  AvaliacaoEquipistaCoordenador,
  CriterioEquipista,
} from "../lib/tipos";
import {
  CRITERIO_COR,
  CRITERIO_LABEL,
  CRITERIOS_LABELS,
} from "./SecaoAvaliacaoEquipistaCoordenadores";
import {
  DadosPessoaForm,
  atualizarPessoa,
  definirAtivacao,
  excluirPessoa,
  previaExclusaoPessoa,
  type PreviaExclusaoPessoa,
} from "../lib/pessoas";
import { adicionarParente, removerParente } from "../lib/parentes";
import {
  aprovarSolicitacaoBloqueio,
  podeAprovar,
} from "../lib/bloqueio";
import {
  vincularVeiculoPessoa,
  desvincularVeiculoPessoa,
  criarVeiculo,
} from "../lib/veiculos";
import { calcularIdade, formatarCPF, formatarData } from "../lib/utilsDominio";

const CORES_CRITERIO: Record<string, string> = {
  Otimo: "#16a34a",
  Bom: "#2563eb",
  Regular: "#ca8a04",
  Ruim: "#dc2626",
};

const ROTULOS_CRITERIO: Record<string, string> = {
  pontualidade: "Pontualidade",
  dedicacao: "Dedicação",
  companheirismo: "Companheirismo",
  espiritualidade: "Espiritualidade",
  comprometimento: "Comprometimento",
  uniforme: "Uniforme",
  convidarNovamente: "Convidaria novamente",
};

type ChaveQuestaoCoordenador =
  | "permanencia"
  | "lideranca"
  | "pontoPositivo"
  | "aspectoMelhorar"
  | "situacaoRegistrar"
  | "recomendacao";

const PERGUNTAS_COORDENADOR_APOIO: { rotulo: string; chave: ChaveQuestaoCoordenador }[] = [
  { rotulo: "1. Permanecer na função na próxima festa?", chave: "permanencia" },
  { rotulo: "2. Perfil de liderança?", chave: "lideranca" },
  { rotulo: "3. Ponto positivo marcante", chave: "pontoPositivo" },
  { rotulo: "4. Aspecto que pode melhorar", chave: "aspectoMelhorar" },
  { rotulo: "5. Situação relevante a registrar", chave: "situacaoRegistrar" },
  { rotulo: "6. Recomendação de permanência ou mudança", chave: "recomendacao" },
];

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
  const [previaExclusao, setPreviaExclusao] = useState<PreviaExclusaoPessoa | null>(null);
  const [previaExclusaoErro, setPreviaExclusaoErro] = useState<string | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [perguntandoMotivo, setPerguntandoMotivo] = useState(false);
  const [motivoInativacao, setMotivoInativacao] = useState("");
  const [searchParams] = useSearchParams();
  const [abaCadastro, setAbaCadastro] = useState<"foto" | "dados" | "filhos" | "veiculos" | "parentes">("dados");
  const historicoInicial = searchParams.get("aba") === "avaliacoes" ? "avaliacoes" as const : "presenca" as const;
  const [abaHistorico, setAbaHistorico] = useState<
    "movimentacao" | "participacoes" | "presenca" | "avaliacoes" | "bloqueios"
  >(historicoInicial);
  const { itens: avaliacoesPessoa } = useAvaliacoesPessoa(id);
  const { itens: avaliacoesCoordenador } = useAvaliacoesCoordenadorPessoa(id);
  const { itens: avaliacoesEquipistaCoord } = useAvaliacoesEquipistaCoordenadorPessoa(id);

  const linhasCoordenador: (
    | { tipo: "apoio"; a: AvaliacaoCoordenador }
    | { tipo: "equipista"; a: AvaliacaoEquipistaCoordenador }
  )[] = [
    ...avaliacoesCoordenador.map((a) => ({ tipo: "apoio" as const, a })),
    ...avaliacoesEquipistaCoord.map((a) => ({ tipo: "equipista" as const, a })),
  ].sort(
    (x, y) =>
      new Date(y.a.atualizadoEm).getTime() - new Date(x.a.atualizadoEm).getTime()
  );

  if (!sessao) return null;
  const ehProprio = !!sessao.pessoaId && sessao.pessoaId === id;
  const podeEditar = temPermissao(sessao, "pessoas.editar") || ehProprio;
  const podeInativar = temPermissao(sessao, "pessoas.ativar");
  const podeExcluir = temPermissao(sessao, "pessoas.excluir");
  const bloquearSensivel = sessao.perfil !== "ADM";
  const podeVerExclusivo = temPermissao(sessao, "exclusivoPessoal");
  const podeBloquear = temPermissao(sessao, "pessoas.bloqueio");
  const pendenteBloqueio = pessoa?.bloqueio?.pendente ?? null;

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

  async function handleAtivacao(ativar: boolean, motivo?: string) {
    if (!sessao || !pessoa) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await definirAtivacao(sessao, pessoa, ativar, motivo);
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

  async function handleAprovarBloqueio(id: string) {
    if (!sessao) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await aprovarSolicitacaoBloqueio(sessao, id);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao aprovar.");
    } finally {
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
                  onClick={() => {
                    setMotivoInativacao("");
                    setPerguntandoMotivo(true);
                  }}
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
                onClick={async () => {
                  setConfirmandoExclusao(true);
                  setPreviaExclusaoErro(null);
                  if (!pessoa) return;
                  setCarregandoPrevia(true);
                  try {
                    setPreviaExclusao(await previaExclusaoPessoa(pessoa.id));
                  } catch (e) {
                    setPreviaExclusaoErro(
                      e instanceof Error ? e.message : "Falha ao carregar a previa."
                    );
                  } finally {
                    setCarregandoPrevia(false);
                  }
                }}
                disabled={acaoOcupado}
                aria-label="Excluir"
                title="Excluir"
              >
                <Icone nome="lixeira" />
              </button>
            )}
          </div>
        )}
        {podeBloquear && !pessoa.bloqueada && !pendenteBloqueio && (
          <button
            type="button"
            className="btn btn-perigo"
            onClick={() => navigate(`/pessoas/${pessoa.id}/bloquear`)}
            disabled={acaoOcupado}
            aria-label="Bloquear"
            title="Bloquear"
          >
            <Icone nome="proibido" />
          </button>
        )}
        {podeBloquear && pessoa.bloqueada && !pendenteBloqueio && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => navigate(`/pessoas/${pessoa.id}/desbloquear`)}
            disabled={acaoOcupado}
            aria-label="Desbloquear"
            title="Desbloquear"
          >
            <Icone nome="cadeado-aberto" />
          </button>
        )}
      </header>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      {pessoa.bloqueio?.ativo && (
        <div className="card border-vermelho/40">
          <div className="card-corpo space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-vermelho-escuro flex items-center gap-2">
                <Icone nome="proibido" tamanho={18} />
                Pessoa bloqueada
              </p>
              {pessoa.bloqueio.bloqueadoEm && (
                <span className="badge badge-vermelho text-xs font-mono">
                  desde {formatarData(pessoa.bloqueio.bloqueadoEm)}
                </span>
              )}
            </div>
            {pessoa.bloqueio.motivo && (
              <p className="text-sm text-vermelho-escuro whitespace-pre-wrap">
                {pessoa.bloqueio.motivo}
              </p>
            )}
          </div>
        </div>
      )}

      {pendenteBloqueio && (
        <div className="card border-azul/40">
          <div className="card-corpo space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-carbone flex items-center gap-2">
                <Icone nome="alerta" tamanho={18} />
                Bloqueio pendente de aprovação
              </p>
              <span className="badge badge-azul text-xs font-mono">
                {formatarData(pendenteBloqueio.criadoEm)}
              </span>
            </div>
            <p className="text-sm text-ardesia whitespace-pre-wrap">
              {pendenteBloqueio.motivo}
            </p>
            <p className="text-xs text-ardesia">
              1º aprovador:{" "}
              <strong className="text-carbone">
                {pendenteBloqueio.aprovador1Nome}
              </strong>
              {podeBloquear &&
                podeAprovar(pendenteBloqueio, sessao) && (
                  <button
                    type="button"
                    className="btn btn-primario ml-3"
                    onClick={() => handleAprovarBloqueio(pendenteBloqueio.id)}
                    disabled={acaoOcupado}
                    aria-label="Aprovar bloqueio"
                    title="Aprovar bloqueio"
                  >
                    <Icone nome="check" />
                  </button>
                )}
            </p>
          </div>
        </div>
      )}

      {confirmandoExclusao && (
        <div className="card border-vermelho/40">
          <div className="card-corpo space-y-3">
            <p className="font-semibold text-vermelho-escuro">
              Excluir {pessoa.nome} (#{pessoa.cracha}) do sistema?
            </p>
            <p className="text-sm text-ardesia">
              A pessoa sera retirada do sistema sem apagar o cadastro, a foto e o
              historico (presencas, avaliacoes, formacoes e participacoes em edicoes
              encerradas). Os vinculos ativos serao desfeitos:
            </p>
            {carregandoPrevia ? (
              <p className="text-sm text-ardesia">Calculando vinculos...</p>
            ) : previaExclusaoErro ? (
              <p className="text-sm text-vermelho">{previaExclusaoErro}</p>
            ) : previaExclusao ? (
              <ul className="text-sm text-ardesia space-y-1">
                <li>
                  Equipes em edicoes em andamento:{" "}
                  <strong>{previaExclusao.vinculos.equipes}</strong>
                </li>
                <li>
                  Veiculos vinculados: <strong>{previaExclusao.vinculos.veiculos}</strong>{" "}
                  (dos quais <strong>{previaExclusao.veiculosSemVinculos}</strong> ficarao sem
                  outra pessoa e serao excluidos logicamente)
                </li>
                <li>
                  Vaga de estacionamento: <strong>{previaExclusao.vinculos.vagas}</strong>
                </li>
                <li>
                  Parentescos: <strong>{previaExclusao.vinculos.parentes}</strong>
                </li>
              </ul>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-perigo"
                onClick={handleExcluir}
                disabled={acaoOcupado || carregandoPrevia}
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

      {perguntandoMotivo && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-carbone/40"
          role="dialog"
          aria-modal="true"
          aria-label="Motivo da inativação"
        >
          <div className="card w-full max-w-md">
            <div className="card-corpo space-y-4">
              <h3 className="m-0">Inativar {pessoa.nome}?</h3>
              <p className="text-sm text-ardesia">
                O cadastro será retirado do quadro corrente sem ser apagado.
              </p>
              <div className="input-grupo">
                <label className="input-label" htmlFor="motivoInativacaoRapida">
                  Motivo da inativação <span className="opcional">(opcional)</span>
                </label>
                <input
                  id="motivoInativacaoRapida"
                  className="input"
                  list="motivos-inativacao-rapida-lista"
                  value={motivoInativacao}
                  onChange={(e) => setMotivoInativacao(e.target.value)}
                  placeholder="Selecione ou escreva o motivo"
                  autoComplete="off"
                />
                <datalist id="motivos-inativacao-rapida-lista">
                  <option value="Saída voluntária" />
                  <option value="Mudança de cidade" />
                  <option value="Indisponibilidade" />
                  <option value="Afastamento temporário" />
                  <option value="Falecimento" />
                </datalist>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-perigo"
                  onClick={() => {
                    setPerguntandoMotivo(false);
                    handleAtivacao(false, motivoInativacao.trim() || undefined);
                  }}
                  disabled={acaoOcupado}
                  aria-label="Confirmar inativação"
                  title="Confirmar inativação"
                >
                  <Icone nome="usuario-x" />
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setPerguntandoMotivo(false)}
                  disabled={acaoOcupado}
                  aria-label="Cancelar"
                  title="Cancelar"
                >
                  <Icone nome="fechar" />
                </button>
              </div>
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
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaHistorico === "bloqueios"}
                  className={`aba ${abaHistorico === "bloqueios" ? "aba-ativa" : ""}`}
                  onClick={() => setAbaHistorico("bloqueios")}
                >
                  Histórico bloqueios
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
                  {avaliacoesPessoa.length === 0 &&
                  avaliacoesCoordenador.length === 0 &&
                  avaliacoesEquipistaCoord.length === 0 ? (
                    <p className="text-sm text-ardesia">Nenhuma avaliação registrada para esta pessoa.</p>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-sm text-ardesia">
                        {avaliacoesPessoa.length + avaliacoesCoordenador.length + avaliacoesEquipistaCoord.length} avaliação(ões) registrada(s)
                      </p>
                      {avaliacoesPessoa.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="m-0">Como equipista</h4>
                          <div className="card">
                            <div className="card-corpo divide-y divide-pietra-clara">
                              {avaliacoesPessoa.map((a) => (
                                <LinhaAvaliacaoEquipista key={a.id} a={a} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {linhasCoordenador.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="m-0">Como coordenador</h4>
                          <div className="card">
                            <div className="card-corpo divide-y divide-pietra-clara">
                              {linhasCoordenador.map((linha) =>
                                linha.tipo === "apoio" ? (
                                  <LinhaAvaliacaoCoordenadorApoio key={linha.a.id} a={linha.a} />
                                ) : (
                                  <LinhaAvaliacaoCoordenadorEquipista key={linha.a.id} a={linha.a} />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {abaHistorico === "bloqueios" && (
                <div className="tabs-painel" role="tabpanel" tabIndex={0}>
                  <HistoricoBloqueiosPessoa pessoaId={pessoa.id} />
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

function LinhaAvaliacaoEquipista({ a }: { a: Avaliacao }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-carbone">
          {a.edicaoNumero ?? a.edicaoId}ª edição
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
        Equipe {a.equipeNome ?? "—"} · Avaliador: {a.avaliadorNome}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
        {Object.entries(a.criterios).map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-ardesia">
              {ROTULOS_CRITERIO[k] ?? k}
            </span>
            <span
              className="font-semibold"
              style={{
                color:
                  typeof v === "number"
                    ? undefined
                    : CORES_CRITERIO[v as string] ??
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
  );
}

function LinhaAvaliacaoCoordenadorApoio({ a }: { a: AvaliacaoCoordenador }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-carbone">
          {a.edicaoNumero ?? a.edicaoId}ª edição
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
        Equipe {a.equipeFilhaNome ?? "—"} · Avaliador: {a.avaliadorNome}
      </p>
      <div className="grid grid-cols-1 gap-y-1 text-xs">
        {PERGUNTAS_COORDENADOR_APOIO.map((q) => (
          <div key={q.chave} className="flex justify-between gap-3">
            <span className="text-ardesia">{q.rotulo}</span>
            <span className="font-semibold text-carbone text-right">
              {a[q.chave] || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinhaAvaliacaoCoordenadorEquipista({ a }: { a: AvaliacaoEquipistaCoordenador }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-carbone">
          {a.edicaoNumero ?? a.edicaoId}ª edição
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-ardesia font-mono">
            {new Date(a.atualizadoEm).toLocaleString("pt-BR")}
          </span>
          <span className="badge badge-verde">Finalizada</span>
        </div>
      </div>
      <p className="text-xs text-ardesia">
        Equipe {a.equipeNome ?? "—"} · Avaliador: {a.avaliadorNome}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
        {CRITERIOS_LABELS.map((c) => {
          const valor = a.criterios[c.chave] as CriterioEquipista;
          return (
            <div key={c.chave} className="flex justify-between">
              <span className="text-ardesia">{c.rotulo}</span>
              <span
                className="font-semibold"
                style={{ color: valor ? CRITERIO_COR[valor] : undefined }}
              >
                {valor ? CRITERIO_LABEL[valor] : "—"}
              </span>
            </div>
          );
        })}
      </div>
      {a.comentarios && (
        <p className="text-xs text-ardesia italic border-t border-pietra-clara pt-2">
          {a.comentarios}
        </p>
      )}
    </div>
  );
}
