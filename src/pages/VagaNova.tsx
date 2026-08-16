// ============================================================================
// CONTROLE DE PERMISSAO
// Criar: vaga.incluir.
// ============================================================================
import { useState, useMemo, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePessoas, useVagas, useEstacionamentos } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { criarVaga, DadosVagaForm, ErroValidacao } from "../lib/vagas";
import { Icone } from "../components/Icone";

export function VagaNova() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens: pessoas, carregando: carregandoPessoas } = usePessoas();
  const { itens: vagas, carregando: carregandoVagas } = useVagas();
  const { itens: estacionamentos } = useEstacionamentos();

  const [dados, setDados] = useState<DadosVagaForm>({
    identificacao: "",
    pessoaIds: [],
    estacionamentoId: null,
  });
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const vinculadas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const v of vagas) {
      for (const p of v.pessoas) mapa.set(p.id, v.identificacao);
    }
    return mapa;
  }, [vagas]);

  const pessoasOrdenadas = useMemo(
    () => [...pessoas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [pessoas]
  );

  const estacionamentoSelecionado = estacionamentos.find(
    (e) => e.id === dados.estacionamentoId
  );

  if (!sessao) return null;
  const podeCriar = temPermissao(sessao, "vaga.incluir");

  if (!podeCriar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissao</h3>
          <p className="text-ardesia">
            Apenas Administracao e Organizacao podem criar vagas.
          </p>
          <Link
            to="/vagas"
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

  function alternarPessoa(pessoaId: string) {
    setDados((d) => ({
      ...d,
      pessoaIds: d.pessoaIds.includes(pessoaId)
        ? d.pessoaIds.filter((id) => id !== pessoaId)
        : [...d.pessoaIds, pessoaId],
    }));
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao) return;
    setErros({});
    setEnviando(true);
    try {
      const id = await criarVaga(sessao, dados);
      navigate(`/vagas/${id}`, { replace: true });
    } catch (e) {
      if (e instanceof ErroValidacao) {
        setErros(e.campos);
      } else if (e instanceof Error) {
        setErros({ _form: e.message });
      } else {
        setErros({ _form: "Falha ao salvar." });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <div className="eyebrow">Gestao de Estacionamento</div>
        <h2 className="mt-1">Nova vaga</h2>
      </header>

      <div className="card">
        <div className="card-corpo">
          <form onSubmit={handleSubmit} className="space-y-5">
            {erros._form && (
              <div className="card border-vermelho/40">
                <div className="card-corpo py-4 text-vermelho-escuro">
                  {erros._form}
                </div>
              </div>
            )}

            <div className="input-grupo">
              <label className="input-label" htmlFor="identificacao">
                Identificacao
              </label>
              <input
                id="identificacao"
                className={`input ${erros.identificacao ? "erro" : ""}`}
                value={dados.identificacao}
                onChange={(e) =>
                  setDados((d) => ({ ...d, identificacao: e.target.value }))
                }
                placeholder="Ex.: Vaga A-01"
                required
              />
              {erros.identificacao && (
                <p className="input-erro-msg">{erros.identificacao}</p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="estacionamentoId">
                Estacionamento (opcional)
              </label>
              <select
                id="estacionamentoId"
                className={`input ${erros.estacionamentoId ? "erro" : ""}`}
                value={dados.estacionamentoId ?? ""}
                onChange={(e) =>
                  setDados((d) => ({
                    ...d,
                    estacionamentoId: e.target.value || null,
                  }))
                }
              >
                <option value="">Nenhum</option>
                {estacionamentos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
              {estacionamentoSelecionado && (
                <p className="text-sm text-ardesia mt-2">
                  {estacionamentoSelecionado.nome} tem{" "}
                  {estacionamentoSelecionado.vagasDistribuidas} de{" "}
                  {estacionamentoSelecionado.vagasContratadas} vagas
                  distribuídas. Este aviso e informativo: nao ha bloqueio por
                  capacidade.
                </p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label">Pessoas</label>
              {carregandoPessoas || carregandoVagas ? (
                <p className="text-ardesia text-sm">Carregando...</p>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto border border-pietra-clara rounded-sm p-3">
                  {pessoasOrdenadas.map((p) => {
                    const jaVinculada = vinculadas.has(p.id);
                    const selecionada = dados.pessoaIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm ${
                          jaVinculada
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer hover:bg-pietra-clara/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selecionada}
                          disabled={jaVinculada}
                          onChange={() => alternarPessoa(p.id)}
                        />
                        <span className="font-mono text-ardesia text-xs shrink-0">
                          #{p.cracha}
                        </span>
                        <span className="text-carbone truncate">{p.nome}</span>
                        {jaVinculada && (
                          <span className="badge badge-cinza ml-auto shrink-0">
                            vaga {vinculadas.get(p.id)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              {erros.pessoaIds && (
                <p className="input-erro-msg">{erros.pessoaIds}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
              <button
                type="submit"
                className="btn btn-primario"
                disabled={enviando}
                aria-label="Cadastrar vaga"
                title="Cadastrar vaga"
              >
                <Icone nome="check" />
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => navigate("/vagas")}
                disabled={enviando}
                aria-label="Cancelar"
                title="Cancelar"
              >
                <Icone nome="fechar" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
