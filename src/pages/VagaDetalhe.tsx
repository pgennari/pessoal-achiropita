// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: vaga.detalhe. Editar: vaga.editar.
// ============================================================================
import { useState, useMemo, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useVaga,
  useHistoricoVaga,
  usePessoas,
  useVagas,
  useEstacionamentos,
} from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  atualizarVaga,
  DadosVagaForm,
  ErroValidacao,
} from "../lib/vagas";
import { Icone } from "../components/Icone";
import { normalizar } from "../lib/utilsDominio";
import { HistoricoEstacionamentoVaga, Pessoa } from "../lib/tipos";

const ROTULO_OPERACAO: Record<HistoricoEstacionamentoVaga["operacao"], string> = {
  associar: "Associação",
  transferir: "Transferência",
  desassociar: "Desassociação",
};

export function VagaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { item: vaga, carregando, erro } = useVaga(id);
  const { itens: historico, carregando: carregandoHistorico } = useHistoricoVaga(id);
  const { itens: pessoas, carregando: carregandoPessoas } = usePessoas();
  const { itens: vagas, carregando: carregandoVagas } = useVagas();
  const { itens: estacionamentos } = useEstacionamentos();

  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState<DadosVagaForm>({
    identificacao: "",
    pessoaIds: [],
    estacionamentoId: null,
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [filtroPessoas, setFiltroPessoas] = useState("");

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

  const pessoasFiltradas = useMemo(() => {
    const t = normalizar(filtroPessoas);
    const base = t
      ? pessoasOrdenadas.filter(
          (p) =>
            normalizar(p.nome).includes(t) || String(p.cracha).includes(t)
        )
      : pessoasOrdenadas;
    const selecionadas: Pessoa[] = [];
    const demais: Pessoa[] = [];
    for (const p of base) {
      if (dados.pessoaIds.includes(p.id)) selecionadas.push(p);
      else demais.push(p);
    }
    return [...selecionadas, ...demais];
  }, [pessoasOrdenadas, filtroPessoas, dados.pessoaIds]);

  if (!sessao) return null;
  const podeEditar = temPermissao(sessao, "vaga.editar");

  if (carregando) {
    return <p className="text-ardesia">Carregando...</p>;
  }

  if (erro || !vaga) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Vaga nao encontrada</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
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

  const vagaAtual = vaga;

  function iniciarEdicao() {
    setDados({
      identificacao: vagaAtual.identificacao,
      pessoaIds: vagaAtual.pessoas.map((p) => p.id),
      estacionamentoId: vagaAtual.estacionamentoId,
    });
    setEditando(true);
  }

  function alternarPessoa(pessoaId: string) {
    setDados((d) => ({
      ...d,
      pessoaIds: d.pessoaIds.includes(pessoaId)
        ? d.pessoaIds.filter((id) => id !== pessoaId)
        : [...d.pessoaIds, pessoaId],
    }));
  }

  async function handleSalvar(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao) return;
    setErros({});
    setEnviando(true);
    try {
      await atualizarVaga(sessao, vagaAtual.id, dados);
      setEditando(false);
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

  if (editando) {
    const estacionamentoSelecionado = estacionamentos.find(
      (e) => e.id === dados.estacionamentoId
    );
    return (
      <div className="space-y-6 max-w-3xl">
        <header>
          <div className="eyebrow">Editando</div>
          <h2 className="mt-1">{vaga.identificacao}</h2>
        </header>

        <div className="card">
          <div className="card-corpo">
            <form onSubmit={handleSalvar} className="space-y-5">
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
                  <>
                    <input
                      className="filtro-coluna mb-2"
                      placeholder="Buscar por nome ou crachá..."
                      value={filtroPessoas}
                      onChange={(e) => setFiltroPessoas(e.target.value)}
                      aria-label="Buscar pessoas"
                    />
                    <div className="space-y-1.5 max-h-80 overflow-y-auto border border-pietra-clara rounded-sm p-3">
                      {pessoasFiltradas.map((p) => {
                        const emOutraVaga =
                          vinculadas.has(p.id) &&
                          !vagaAtual.pessoas.some((vp) => vp.id === p.id);
                        const selecionada = dados.pessoaIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm ${
                              emOutraVaga
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer hover:bg-pietra-clara/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={selecionada}
                              disabled={emOutraVaga}
                              onChange={() => alternarPessoa(p.id)}
                            />
                            <span className="font-mono text-ardesia text-xs shrink-0">
                              #{p.cracha}
                            </span>
                            <span className="text-carbone truncate">
                              {p.nome}
                            </span>
                            {emOutraVaga && (
                              <span className="badge badge-cinza ml-auto shrink-0">
                                vaga {vinculadas.get(p.id)}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {pessoasFiltradas.length === 0 && (
                      <p className="text-ardesia text-sm mt-2">
                        Nenhuma pessoa encontrada para esta busca.
                      </p>
                    )}
                  </>
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
                  aria-label="Salvar alteracoes"
                  title="Salvar alteracoes"
                >
                  <Icone nome="check" />
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setEditando(false)}
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

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/vagas" className="eyebrow">
            ← Vagas
          </Link>
          <h2 className="mt-1">{vaga.identificacao}</h2>
        </div>
        {podeEditar && (
          <button
            type="button"
            className="btn btn-secundario"
            onClick={iniciarEdicao}
            aria-label="Editar"
            title="Editar"
          >
            <Icone nome="lapis" />
          </button>
        )}
      </header>

      <section className="card">
        <div className="card-corpo space-y-3">
          <Linha
            rotulo="Estacionamento"
            valor={vaga.estacionamentoNome ?? "Nao vinculada a estacionamento"}
          />
          <div>
            <div className="text-xs uppercase tracking-wide text-ardesia font-mono">
              Pessoas ({vaga.pessoas.length})
            </div>
            {vaga.pessoas.length === 0 ? (
              <div className="text-ardesia text-sm mt-1">
                Nenhuma pessoa vinculada.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {vaga.pessoas.map((p) => (
                  <span key={p.id} className="badge badge-cinza">
                    #{p.cracha} {p.nome}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-corpo">
          <h4 className="mb-3">Historico de estacionamento</h4>
          {carregandoHistorico ? (
            <p className="text-ardesia text-sm">Carregando...</p>
          ) : historico.length === 0 ? (
            <p className="text-ardesia text-sm">
              Sem historico de associacao a estacionamentos.
            </p>
          ) : (
            <div className="divide-y divide-pietra-clara">
              {historico.map((h) => (
                <div key={h.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        h.operacao === "desassociar"
                          ? "badge badge-vermelho"
                          : h.operacao === "transferir"
                            ? "badge badge-ouro"
                            : "badge badge-verde"
                      }
                    >
                      {ROTULO_OPERACAO[h.operacao]}
                    </span>
                    <span className="text-sm text-carbone">
                      {h.estacionamentoNome || "Nenhum estacionamento"}
                    </span>
                  </div>
                  <div className="text-xs text-ardesia mt-1">
                    {h.autorNome} · {formatarDataHora(h.criadoEm)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/vagas")}
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

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}
