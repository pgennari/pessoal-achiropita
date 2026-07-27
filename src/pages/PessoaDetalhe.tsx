import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PessoaForm } from "../components/PessoaForm";
import { UploadFoto } from "../components/UploadFoto";
import { HistoricoPessoa } from "../components/HistoricoPessoa";
import { VinculoVeiculo } from "../components/VinculoVeiculo";
import { usePessoa, usePessoas, useVeiculos, useVeiculosPessoa } from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import {
  DadosPessoaForm,
  atualizarPessoa,
  definirAtivacao,
  excluirPessoa,
} from "../lib/pessoas";
import {
  vincularVeiculoPessoa,
  desvincularVeiculoPessoa,
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
  const [editando, setEditando] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  if (!sessao) return null;
  const ehProprio = !!sessao.pessoaId && sessao.pessoaId === id;
  const podeEditar =
    sessao.perfil === "ADM" ||
    sessao.perfil === "ORG" ||
    sessao.perfil === "OPC" ||
    ehProprio;
  const podeInativar = sessao.perfil === "ADM" || sessao.perfil === "ORG";
  const podeExcluir = sessao.perfil === "ADM";
  const bloquearSensivel = sessao.perfil !== "ADM";

  if (carregando) {
    return <p className="text-ardesia">Carregando...</p>;
  }

  if (erro || !pessoa) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Pessoa não encontrada</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
          <Link to="/pessoas" className="btn btn-secundario mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  async function handleSalvar(dados: DadosPessoaForm) {
    if (!sessao || !pessoa) return;
    await atualizarPessoa(sessao, pessoa.id, dados, itens);
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
              textoBotao="Salvar alterações"
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
            >
              Editar
            </button>
            {podeInativar &&
              (pessoa.ativo ? (
                <button
                  type="button"
                  className="btn btn-perigo"
                  onClick={() => handleAtivacao(false)}
                  disabled={acaoOcupado}
                >
                  Inativar
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={() => handleAtivacao(true)}
                  disabled={acaoOcupado}
                >
                  Reativar
                </button>
              ))}
            {podeExcluir && !confirmandoExclusao && (
              <button
                type="button"
                className="btn btn-perigo"
                onClick={() => setConfirmandoExclusao(true)}
                disabled={acaoOcupado}
              >
                Excluir
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
              >
                {acaoOcupado ? "Excluindo..." : "Confirmar exclusao"}
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setConfirmandoExclusao(false)}
                disabled={acaoOcupado}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="card">
        <div className="card-corpo">
          <UploadFoto sessao={sessao} pessoa={pessoa} podeEditar={podeEditar} />
        </div>
      </section>

      <section className="card">
        <div className="card-corpo grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Linha
            rotulo="Nascimento"
            valor={`${formatarData(pessoa.nascimento)}${
              idade !== null ? ` · ${idade} anos` : ""
            }`}
          />
          <Linha rotulo="Estado civil" valor={pessoa.estadoCivil ?? "—"} />
          <Linha rotulo="Telefone" valor={pessoa.telefone || "—"} />
          <Linha rotulo="E-mail" valor={pessoa.email ?? "—"} />
          <Linha
            rotulo="CPF"
            valor={pessoa.cpf ? formatarCPF(pessoa.cpf) : "—"}
          />
          <Linha rotulo="RG" valor={pessoa.rg ?? "—"} />
          <Linha rotulo="Endereço" valor={pessoa.endereco ?? "—"} />
          <Linha rotulo="Bairro" valor={pessoa.bairro ?? "—"} />
        </div>
      </section>

      <section className="card">
        <div className="card-corpo">
          <h4 className="mb-3">Filhos</h4>
          {pessoa.filhos.length === 0 ? (
            <p className="text-ardesia text-sm">Nenhum filho cadastrado.</p>
          ) : (
            <ul className="divide-y divide-pietra-clara">
              {pessoa.filhos.map((f) => (
                <li
                  key={f.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-carbone">{f.nome}</div>
                    <div className="text-xs text-ardesia">
                      {formatarData(f.nascimento)}
                      {(() => {
                        const i = calcularIdade(f.nascimento);
                        return i !== null ? ` · ${i} anos` : "";
                      })()}
                    </div>
                  </div>
                  {f.frequentaRecreacao && (
                    <span className="badge badge-azul">recreação</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-corpo">
          <VinculoVeiculo
            titulo="Veículos"
            veiculosDisponiveis={veiculos.filter(
              (v) => !veiculosPessoa.some((vp) => vp.id === v.id)
            )}
            veiculosVinculados={veiculosPessoa}
            aoVincular={async (veiculoId) => {
              await vincularVeiculoPessoa(id!, veiculoId);
              await queryClient.invalidateQueries({ queryKey: ["pessoas", id, "veiculos"] });
            }}
            aoDesvincular={async (veiculoId) => {
              await desvincularVeiculoPessoa(id!, veiculoId);
              await queryClient.invalidateQueries({ queryKey: ["pessoas", id, "veiculos"] });
            }}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-corpo">
          <h4 className="mb-4">Histórico de participações</h4>
          <HistoricoPessoa pessoa={pessoa} />
        </div>
      </section>

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
        >
          Voltar
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
