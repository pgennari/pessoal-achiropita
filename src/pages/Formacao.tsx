import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useBarracas,
  useEdicaoAtiva,
  useFormacoes,
  useLinksEdicao,
  useParticipacoes,
  usePessoas,
  useTurmasFormacao,
} from "../lib/hooks";
import {
  DadosTurmaForm,
  atualizarTurma,
  criarTurma,
  removerTurma,
} from "../lib/turmas";
import {
  ErroFormacao,
  confirmarDadosManual,
  marcarPresencaManual,
  removerFormacao,
} from "../lib/formacoes";
import { gerarLinkDeTurma } from "../lib/links";
import { urlPublica } from "../lib/links";
import { TurmaForm } from "../components/TurmaForm";
import { LinkDaTurma } from "../components/LinkDaTurma";
import {
  Barraca,
  Formacao,
  FUNCOES,
  Funcao,
  LinkValidacao,
  Participacao,
  Pessoa,
  SETORES,
  Setor,
  TurmaFormacao,
} from "../lib/tipos";
import { formatarData, normalizar, soDigitos } from "../lib/utilsDominio";

// --- tipos auxiliares ---

interface GrupoBarraca {
  barracaId: string;
  barracaNome: string;
  setor: Setor;
  pessoas: Pessoa[];
}

function agruparPorBarraca(
  pessoas: Pessoa[],
  indiceParticipacao: Map<string, Participacao>,
  indiceBarraca: Map<string, Barraca>
): GrupoBarraca[] {
  const grupos = new Map<string, GrupoBarraca>();
  for (const p of pessoas) {
    const part = indiceParticipacao.get(p.id);
    if (!part) continue;
    const barraca = indiceBarraca.get(part.barracaId);
    if (!barraca) continue;
    if (!grupos.has(part.barracaId)) {
      grupos.set(part.barracaId, {
        barracaId: part.barracaId,
        barracaNome: barraca.nome,
        setor: barraca.setor,
        pessoas: [],
      });
    }
    grupos.get(part.barracaId)!.pessoas.push(p);
  }
  return [...grupos.values()].sort((a, b) =>
    a.barracaNome.localeCompare(b.barracaNome, "pt-BR")
  );
}

function rotuloSetor(s: Setor): string {
  return s === "Alimentacao" ? "Alimentação" : s;
}

// --- componente principal ---

export function PaginaFormacao() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const { itens: turmas, carregando: carregandoTurmas } = useTurmasFormacao(
    edicao?.id
  );
  const { itens: barracas } = useBarracas(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: formacoes } = useFormacoes(edicao?.id);
  const { itens: pessoas } = usePessoas();
  const { itens: linksEdicao } = useLinksEdicao(edicao?.id);

  const [criandoTurma, setCriandoTurma] = useState(false);
  const [editandoTurmaId, setEditandoTurmaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Modal presença manual
  const [marcandoPara, setMarcandoPara] = useState<{
    pessoa: Pessoa;
    turmaId?: string;
  } | null>(null);
  const [justificativa, setJustificativa] = useState("");

  // Modal visualizar justificativa
  const [vendoJustificativa, setVendoJustificativa] = useState<{
    formacao: Formacao;
    pessoa: Pessoa;
  } | null>(null);

  // Confirmação manual de dados pelo operador (OPC/ADM/ORG)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  // Modal compartilhar link individual (US-06-04)
  const [compartilhandoPara, setCompartilhandoPara] = useState<{
    pessoa: Pessoa;
    formacao: Formacao;
  } | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [copiouLink, setCopiouLink] = useState<string | null>(null);

  // Filtros (US-06-04)
  const [busca, setBusca] = useState("");
  const [filtroSetor, setFiltroSetor] = useState<Setor | "">("");
  const [filtroFuncao, setFiltroFuncao] = useState<Funcao | "">("");

  const turmaEditando =
    turmas.find((t) => t.id === editandoTurmaId) ?? null;

  const podeAdministrar =
    !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");

  const podeConfirmarDados =
    !!sessao &&
    (sessao.perfil === "ADM" ||
      sessao.perfil === "ORG" ||
      sessao.perfil === "OPC");

  // Índices derivados ---

  const indiceParticipacaoPorPessoa = useMemo(() => {
    const m = new Map<string, Participacao>();
    for (const p of participacoes) m.set(p.pessoaId, p);
    return m;
  }, [participacoes]);

  const indiceBarracaById = useMemo(() => {
    const m = new Map<string, Barraca>();
    for (const b of barracas) m.set(b.id, b);
    return m;
  }, [barracas]);

  const indiceFormacoes = useMemo(() => {
    const m = new Map<string, Formacao>();
    for (const f of formacoes) m.set(f.pessoaId, f);
    return m;
  }, [formacoes]);

  const indiceTurmas = useMemo(() => {
    const m = new Map<string, TurmaFormacao>();
    for (const t of turmas) m.set(t.id, t);
    return m;
  }, [turmas]);

  // Links ativos (não expirados) da edição, para compartilhamento
  const linksAtivos = useMemo(
    () =>
      linksEdicao.filter(
        (l) => l.status === "ativo" && new Date(l.expiraEm) > new Date()
      ),
    [linksEdicao]
  );

  // Pessoas alocadas na edição ativa (com participação ativa)
  const alocados = useMemo<Pessoa[]>(() => {
    const ids = new Set(participacoes.map((p) => p.pessoaId));
    return pessoas.filter((p) => ids.has(p.id) && p.ativo);
  }, [participacoes, pessoas]);

  // Alocados após filtros de busca, setor e função (US-06-04)
  const alocadosFiltrados = useMemo(() => {
    const t = normalizar(busca);
    const td = soDigitos(busca);
    return alocados.filter((p) => {
      const part = indiceParticipacaoPorPessoa.get(p.id);

      if (busca) {
        const matchNome = normalizar(p.nome).includes(t);
        const matchCracha = td && String(p.cracha) === busca.trim();
        const matchCpf = td && soDigitos(p.cpf ?? "").includes(td);
        if (!matchNome && !matchCracha && !matchCpf) return false;
      }

      if (filtroFuncao) {
        if (!part || part.funcao !== filtroFuncao) return false;
      }

      if (filtroSetor) {
        if (!part) return false;
        const barraca = indiceBarracaById.get(part.barracaId);
        if (!barraca || barraca.setor !== filtroSetor) return false;
      }

      return true;
    });
  }, [
    alocados,
    busca,
    filtroSetor,
    filtroFuncao,
    indiceParticipacaoPorPessoa,
    indiceBarracaById,
  ]);

  // Lista A: sem formação registrada
  const semFormacao = useMemo(
    () => alocadosFiltrados.filter((p) => !indiceFormacoes.has(p.id)),
    [alocadosFiltrados, indiceFormacoes]
  );

  // Lista B: formação existente mas dados não validados (presença manual pendente)
  const pendentesValidacao = useMemo(
    () =>
      alocadosFiltrados.filter(
        (p) => indiceFormacoes.get(p.id)?.dadosValidados === false
      ),
    [alocadosFiltrados, indiceFormacoes]
  );

  // Confirmados: formação com dados validados
  const confirmados = useMemo(
    () =>
      alocadosFiltrados.filter(
        (p) => indiceFormacoes.get(p.id)?.dadosValidados === true
      ),
    [alocadosFiltrados, indiceFormacoes]
  );

  // Agrupamentos por barraca para Lista A e Lista B
  const gruposSemFormacao = useMemo(
    () =>
      agruparPorBarraca(
        semFormacao,
        indiceParticipacaoPorPessoa,
        indiceBarracaById
      ),
    [semFormacao, indiceParticipacaoPorPessoa, indiceBarracaById]
  );

  const gruposPendentesValidacao = useMemo(
    () =>
      agruparPorBarraca(
        pendentesValidacao,
        indiceParticipacaoPorPessoa,
        indiceBarracaById
      ),
    [pendentesValidacao, indiceParticipacaoPorPessoa, indiceBarracaById]
  );

  const totalPresencas = formacoes.length;
  const pctPresencas =
    alocados.length > 0
      ? Math.round((totalPresencas / alocados.length) * 100)
      : 0;

  if (!sessao) return null;
  if (!podeConfirmarDados) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Sem acesso a esta seção.
          </p>
          <Link to="/" className="btn btn-secundario mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }
  if (carregandoEdicao) return <p className="text-ardesia">Carregando...</p>;
  if (!edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem edição ativa</h3>
          <p className="text-ardesia">
            Marque uma edição como ativa para gerenciar formação.
          </p>
          <Link to="/edicoes" className="btn btn-primario mt-4">
            Abrir edições
          </Link>
        </div>
      </div>
    );
  }

  // --- handlers ---

  async function handleCriarTurma(dados: DadosTurmaForm) {
    if (!sessao || !edicao) return;
    await criarTurma(sessao, edicao.id, dados);
    setCriandoTurma(false);
  }

  async function handleSalvarTurma(dados: DadosTurmaForm) {
    if (!sessao || !turmaEditando) return;
    await atualizarTurma(sessao, turmaEditando, dados);
    setEditandoTurmaId(null);
  }

  async function handleRemoverTurma(t: TurmaFormacao) {
    if (!sessao) return;
    if (
      !confirm(
        `Remover a turma ${formatarData(t.data)} ${t.horarioInicio} (${t.local})?`
      )
    )
      return;
    setErro(null);
    try {
      await removerTurma(sessao, t);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  async function handleConfirmarMarcacao() {
    if (!sessao || !edicao || !marcandoPara) return;
    setErro(null);
    try {
      await marcarPresencaManual(sessao, {
        edicaoId: edicao.id,
        pessoaId: marcandoPara.pessoa.id,
        pessoaNome: marcandoPara.pessoa.nome,
        cracha: marcandoPara.pessoa.cracha,
        turmaId: marcandoPara.turmaId,
        justificativa,
      });
      setMarcandoPara(null);
      setJustificativa("");
    } catch (e) {
      if (e instanceof ErroFormacao) setErro(e.message);
      else setErro(e instanceof Error ? e.message : "Falha ao registrar.");
    }
  }

  async function handleConfirmarDados(f: Formacao, p: Pessoa) {
    if (!sessao) return;
    setErro(null);
    setConfirmandoId(f.id);
    try {
      await confirmarDadosManual(sessao, f, p.nome, p.cracha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao confirmar dados.");
    } finally {
      setConfirmandoId(null);
    }
  }

  async function handleRemoverFormacao(f: Formacao) {
    if (!sessao) return;
    const part = indiceParticipacaoPorPessoa.get(f.pessoaId);
    const barraca = part ? indiceBarracaById.get(part.barracaId) : undefined;
    const pessoaNome = barraca?.nome ?? f.pessoaId;
    const snap = pessoas.find((p) => p.id === f.pessoaId);
    const nome = snap?.nome ?? pessoaNome;
    const cracha = snap?.cracha ?? 0;
    if (
      !confirm(
        `Remover registro de formação de ${nome}? Ela voltará para a lista de pendentes.`
      )
    )
      return;
    setErro(null);
    try {
      await removerFormacao(sessao, f, nome, cracha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao remover formação.");
    }
  }

  async function handleCopiarLink(link: LinkValidacao) {
    try {
      await navigator.clipboard.writeText(urlPublica(link.id));
      setCopiouLink(link.id);
      setTimeout(
        () => setCopiouLink((c) => (c === link.id ? null : c)),
        2000
      );
    } catch {
      setErroLink("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  async function handleGerarLinkParaCompartilhar(turma: TurmaFormacao) {
    if (!sessao) return;
    setErroLink(null);
    setGerandoLink(true);
    try {
      await gerarLinkDeTurma(sessao, turma);
    } catch (e) {
      setErroLink(e instanceof Error ? e.message : "Falha ao gerar link.");
    } finally {
      setGerandoLink(false);
    }
  }

  // --- render ---

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Operação</div>
        <h2 className="mt-1">Formação</h2>
        <p className="text-ardesia text-sm">
          {edicao.numero}ª edição ({edicao.ano}) ·{" "}
          <span className="font-mono">{totalPresencas}</span> de{" "}
          <span className="font-mono">{alocados.length}</span> alocados com
          formação ({pctPresencas}%)
        </p>
      </header>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {/* Seção de turmas */}
      {podeAdministrar && <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3>Turmas</h3>
            <p className="text-ardesia text-sm">
              {carregandoTurmas
                ? "Carregando..."
                : `${turmas.length} turma(s)`}
            </p>
          </div>
          {!criandoTurma && !turmaEditando && (
            <button
              type="button"
              className="btn btn-primario btn-pequeno"
              onClick={() => setCriandoTurma(true)}
            >
              Nova turma
            </button>
          )}
        </div>

        {criandoTurma && (
          <div className="card mb-4">
            <div className="card-corpo">
              <h4 className="mb-3">Nova turma</h4>
              <TurmaForm
                barracas={barracas}
                onSubmit={handleCriarTurma}
                onCancelar={() => setCriandoTurma(false)}
                textoBotao="Cadastrar turma"
              />
            </div>
          </div>
        )}

        {turmaEditando && (
          <div className="card mb-4">
            <div className="card-corpo">
              <h4 className="mb-3">
                Editando turma {formatarData(turmaEditando.data)}{" "}
                {turmaEditando.horarioInicio}
              </h4>
              <TurmaForm
                inicial={turmaEditando}
                barracas={barracas}
                onSubmit={handleSalvarTurma}
                onCancelar={() => setEditandoTurmaId(null)}
                textoBotao="Salvar alterações"
              />
            </div>
          </div>
        )}

        {turmas.length === 0 && !carregandoTurmas && (
          <div className="card">
            <div className="card-corpo text-ardesia text-center">
              Nenhuma turma cadastrada.
            </div>
          </div>
        )}

        <div className="space-y-4">
          {turmas.map((t) => {
            const barraca = barracas.find((b) => b.id === t.barracaIdVinculo);
            return (
              <div key={t.id} className="card">
                <div className="card-corpo space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-xl">
                        {formatarData(t.data)} ·{" "}
                        <span className="font-mono">
                          {t.horarioInicio}
                          {t.horarioFim ? `–${t.horarioFim}` : ""}
                        </span>
                      </div>
                      <div className="text-ardesia text-sm">
                        {t.local} · capacidade {t.capacidadeMaxima}
                        {barraca
                          ? ` · ${barraca.nome}`
                          : t.setorVinculo
                          ? ` · setor ${rotuloSetor(t.setorVinculo)}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-secundario btn-pequeno"
                        onClick={() => setEditandoTurmaId(t.id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-texto btn-pequeno text-vermelho-escuro"
                        onClick={() => handleRemoverTurma(t)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-pietra-clara pt-4">
                    <LinkDaTurma turma={t} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>}

      {/* Filtros de pendências (US-06-04) */}
      <section className="space-y-4">
        <div>
          <h3>Pendências</h3>
          <p className="text-ardesia text-sm">
            Use os filtros para localizar e acompanhar as pendências por setor
            ou função.
          </p>
        </div>

        <div className="card">
          <div className="card-corpo">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                className="input"
                placeholder="Buscar por nome, crachá ou CPF..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <select
                className="input"
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value as Setor | "")}
              >
                <option value="">Todos os setores</option>
                {SETORES.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filtroFuncao}
                onChange={(e) =>
                  setFiltroFuncao(e.target.value as Funcao | "")
                }
              >
                <option value="">Todas as funções</option>
                {FUNCOES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lista A — Sem formação */}
        {podeAdministrar && <div>
          <div className="flex items-center gap-3 mb-3">
            <h4 className="m-0">Sem formação</h4>
            <span className="badge badge-cinza">{semFormacao.length}</span>
          </div>
          <p className="text-ardesia text-sm mb-3">
            Equipistas alocados que ainda não têm presença registrada.
          </p>
          {gruposSemFormacao.length === 0 ? (
            <div className="card">
              <div className="card-corpo text-ardesia text-center">
                {semFormacao.length === 0
                  ? "Nenhuma pendência de formação."
                  : "Nenhum resultado para os filtros aplicados."}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {gruposSemFormacao.map((grupo) => (
                <GrupoBarracaTabela
                  key={grupo.barracaId}
                  grupo={grupo}
                  colunaStatus={false}
                  onRowClick={(p) => {
                    setMarcandoPara({ pessoa: p });
                    setJustificativa("");
                  }}
                  renderAcoes={(p) => (
                    <button
                      type="button"
                      className="btn btn-primario btn-pequeno"
                      onClick={() => {
                        setMarcandoPara({ pessoa: p });
                        setJustificativa("");
                      }}
                    >
                      Marcar manual
                    </button>
                  )}
                />
              ))}
            </div>
          )}
        </div>}

        {/* Lista B — Aguardando validação de dados */}
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h4 className="m-0">Aguardando validação de dados</h4>
            <span className="badge badge-ouro">
              {pendentesValidacao.length}
            </span>
            {/* TODO(US-06-04): "Notificar todos" requer FCM push e serviço de
                e-mail — exige Cloud Functions (plano Blaze). Não implementado
                no MVP Spark. */}
            <button
              type="button"
              className="btn btn-secundario btn-pequeno ml-auto opacity-50 cursor-not-allowed"
              disabled
              title="Requer Cloud Functions (plano Blaze) — não disponível no Spark"
            >
              Notificar todos
            </button>
          </div>
          <p className="text-ardesia text-sm mb-3">
            Presença registrada manualmente. O equipista ainda não confirmou
            seus dados pelo link público.
          </p>
          {gruposPendentesValidacao.length === 0 ? (
            <div className="card">
              <div className="card-corpo text-ardesia text-center">
                {pendentesValidacao.length === 0
                  ? "Nenhuma validação pendente."
                  : "Nenhum resultado para os filtros aplicados."}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {gruposPendentesValidacao.map((grupo) => (
                <GrupoBarracaTabela
                  key={grupo.barracaId}
                  grupo={grupo}
                  colunaStatus
                  renderStatus={(p) => {
                    const f = indiceFormacoes.get(p.id);
                    if (!f) return null;
                    return (
                      <button
                        type="button"
                        className="badge badge-ouro hover:underline cursor-pointer"
                        onClick={() =>
                          setVendoJustificativa({ formacao: f, pessoa: p })
                        }
                        title="Ver justificativa"
                      >
                        manual
                      </button>
                    );
                  }}
                  renderAcoes={(p) => {
                    const f = indiceFormacoes.get(p.id);
                    return (
                      <div className="flex gap-2 justify-end flex-wrap">
                        {podeConfirmarDados && f && (
                          <button
                            type="button"
                            className="btn btn-primario btn-pequeno"
                            disabled={confirmandoId === f.id}
                            onClick={() => handleConfirmarDados(f, p)}
                          >
                            {confirmandoId === f.id
                              ? "Confirmando..."
                              : "Confirmar dados"}
                          </button>
                        )}
                        {podeAdministrar && (
                          <button
                            type="button"
                            className="btn btn-secundario btn-pequeno"
                            onClick={() => {
                              if (f) {
                                setErroLink(null);
                                setCopiouLink(null);
                                setCompartilhandoPara({
                                  pessoa: p,
                                  formacao: f,
                                });
                              }
                            }}
                          >
                            Compartilhar link
                          </button>
                        )}
                        {podeAdministrar && f && (
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={() => handleRemoverFormacao(f)}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Confirmados */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h4 className="m-0">Confirmados</h4>
            <span className="badge badge-verde">{confirmados.length}</span>
          </div>
          {confirmados.length === 0 ? (
            <div className="card">
              <div className="card-corpo text-ardesia text-center">
                Nenhum confirmado ainda.
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="tabela-rolavel">
                <table className="tabela-larga">
                  <thead className="bg-pietra-clara/60 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-20">Crachá</th>
                      <th className="px-4 py-3 font-semibold">Pessoa</th>
                      <th className="px-4 py-3 font-semibold">Barraca</th>
                      <th className="px-4 py-3 font-semibold w-36">Status</th>
                      <th className="px-4 py-3 font-semibold w-32 text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmados.map((p) => {
                      const f = indiceFormacoes.get(p.id);
                      const part = indiceParticipacaoPorPessoa.get(p.id);
                      const barraca = part
                        ? indiceBarracaById.get(part.barracaId)
                        : undefined;
                      return (
                        <tr
                          key={p.id}
                          className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                        >
                          <td className="px-4 py-3 font-mono text-ardesia">
                            #{p.cracha}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/pessoas/${p.id}`}
                              className="font-semibold text-carbone hover:text-verde"
                            >
                              {p.nome}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-ardesia">
                            {barraca?.nome ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="badge badge-verde">validado</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {f && (
                              <button
                                type="button"
                                className="btn btn-texto btn-pequeno text-vermelho-escuro"
                                onClick={() => handleRemoverFormacao(f)}
                              >
                                Remover
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal — Presença manual */}
      {marcandoPara && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-carbone/40"
          onClick={() => setMarcandoPara(null)}
        >
          <div
            className="card w-full max-w-lg shadow-media"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-corpo space-y-4">
              <div>
                <div className="eyebrow">Presença manual</div>
                <h3>{marcandoPara.pessoa.nome}</h3>
                <p className="text-ardesia text-sm font-mono">
                  #{marcandoPara.pessoa.cracha}
                </p>
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="turma">
                  Turma <span className="opcional">(opcional)</span>
                </label>
                <select
                  id="turma"
                  className="input"
                  value={marcandoPara.turmaId ?? ""}
                  onChange={(e) =>
                    setMarcandoPara({
                      ...marcandoPara,
                      turmaId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">—</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatarData(t.data)} {t.horarioInicio} · {t.local}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-grupo m-0">
                <label className="input-label" htmlFor="justificativa">
                  Justificativa
                </label>
                <textarea
                  id="justificativa"
                  className="input"
                  rows={3}
                  placeholder="Ex: Sem celular para validar pelo link"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
                <p className="input-ajuda">
                  Será registrada na auditoria. Pessoa entra na fila de
                  validação pendente até confirmar dados pelo link público.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-pietra-clara">
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={handleConfirmarMarcacao}
                  disabled={justificativa.trim().length < 3}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setMarcandoPara(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Ver justificativa */}
      {vendoJustificativa && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-carbone/40"
          onClick={() => setVendoJustificativa(null)}
        >
          <div
            className="card w-full max-w-lg shadow-media"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-corpo space-y-4">
              <div>
                <div className="eyebrow">Presença manual</div>
                <h3>{vendoJustificativa.pessoa.nome}</h3>
                <p className="text-ardesia text-sm font-mono">
                  #{vendoJustificativa.pessoa.cracha}
                </p>
              </div>

              <div className="space-y-1">
                <div className="eyebrow">Justificativa</div>
                <p className="whitespace-pre-wrap">
                  {vendoJustificativa.formacao.justificativa?.trim() ||
                    "(sem justificativa registrada)"}
                </p>
              </div>

              <div className="text-ardesia text-sm">
                Registrado por{" "}
                <strong>
                  {vendoJustificativa.formacao.registradoPorNome}
                </strong>{" "}
                em{" "}
                <span className="font-mono">
                  {formatarData(vendoJustificativa.formacao.presencaEm)}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-pietra-clara">
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setVendoJustificativa(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Compartilhar link individual (US-06-04) */}
      {compartilhandoPara && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-carbone/40"
          onClick={() => {
            setCompartilhandoPara(null);
            setErroLink(null);
            setCopiouLink(null);
          }}
        >
          <div
            className="card w-full max-w-lg shadow-media"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-corpo space-y-4">
              <div>
                <div className="eyebrow">Compartilhar link de validação</div>
                <h3>{compartilhandoPara.pessoa.nome}</h3>
                <p className="text-ardesia text-sm font-mono">
                  #{compartilhandoPara.pessoa.cracha}
                </p>
              </div>

              {erroLink && (
                <p className="text-vermelho-escuro text-sm">{erroLink}</p>
              )}

              {linksAtivos.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-ardesia text-sm">
                    Selecione um link ativo abaixo para compartilhar com a
                    pessoa:
                  </p>
                  {linksAtivos.map((link) => {
                    const turma = indiceTurmas.get(link.turmaId);
                    const url = urlPublica(link.id);
                    const msgWpp = encodeURIComponent(
                      `Olá ${compartilhandoPara.pessoa.nome}, acesse o link para confirmar seus dados na ${edicao.numero}ª Festa da Achiropita:\n${url}`
                    );
                    const msgEmail = encodeURIComponent(
                      `Olá ${compartilhandoPara.pessoa.nome},\n\nAcesse o link abaixo para confirmar seus dados na ${edicao.numero}ª Festa da Achiropita:\n\n${url}\n\nAtenção: o link expira em ${new Date(link.expiraEm).toLocaleString("pt-BR")}.`
                    );
                    return (
                      <div
                        key={link.id}
                        className="border border-pietra-clara rounded-sm p-3 space-y-2"
                      >
                        {turma && (
                          <div className="text-sm font-semibold">
                            {formatarData(turma.data)} {turma.horarioInicio} ·{" "}
                            {turma.local}
                          </div>
                        )}
                        <code className="block bg-pietra-clara/40 rounded-sm px-2 py-1 text-xs break-all">
                          {url}
                        </code>
                        <div className="text-xs text-ardesia">
                          expira{" "}
                          {new Date(link.expiraEm).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {link.contadorUsos} uso(s)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-secundario btn-pequeno"
                            onClick={() => handleCopiarLink(link)}
                          >
                            {copiouLink === link.id ? "Copiado!" : "Copiar URL"}
                          </button>
                          <a
                            href={`https://wa.me/?text=${msgWpp}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primario btn-pequeno"
                          >
                            WhatsApp
                          </a>
                          {compartilhandoPara.pessoa.email && (
                            <a
                              href={`mailto:${compartilhandoPara.pessoa.email}?subject=${encodeURIComponent(`Validação de dados — ${edicao.numero}ª Festa da Achiropita`)}&body=${msgEmail}`}
                              className="btn btn-secundario btn-pequeno"
                            >
                              E-mail
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-ardesia text-sm">
                    Nenhum link ativo no momento. Gere um link para uma das
                    turmas na seção "Turmas" acima.
                  </p>
                  {turmas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">
                        Gerar link para turma:
                      </p>
                      {turmas.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-3 border border-pietra-clara rounded-sm px-3 py-2"
                        >
                          <span className="text-sm">
                            {formatarData(t.data)} {t.horarioInicio} ·{" "}
                            {t.local}
                          </span>
                          <button
                            type="button"
                            className="btn btn-primario btn-pequeno"
                            disabled={gerandoLink}
                            onClick={() =>
                              handleGerarLinkParaCompartilhar(t)
                            }
                          >
                            {gerandoLink ? "Gerando..." : "Gerar link"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-pietra-clara">
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => {
                    setCompartilhandoPara(null);
                    setErroLink(null);
                    setCopiouLink(null);
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- componente auxiliar para tabela por barraca ---

interface GrupoBarracaTabelaProps {
  grupo: GrupoBarraca;
  colunaStatus: boolean;
  renderStatus?: (p: Pessoa) => React.ReactNode;
  renderAcoes: (p: Pessoa) => React.ReactNode;
  onRowClick?: (p: Pessoa) => void;
}

function GrupoBarracaTabela({
  grupo,
  colunaStatus,
  renderStatus,
  renderAcoes,
  onRowClick,
}: GrupoBarracaTabelaProps) {
  return (
    <div className="card overflow-hidden">
      <div className="card-corpo flex flex-wrap items-center gap-3 border-b border-pietra-clara py-3">
        <span className="font-semibold">{grupo.barracaNome}</span>
        <span className="badge badge-cinza text-xs">
          {rotuloSetor(grupo.setor)}
        </span>
        <span className="badge badge-cinza ml-auto">{grupo.pessoas.length}</span>
      </div>
      <div className="tabela-rolavel">
        <table className="tabela-larga">
          <thead className="bg-pietra-clara/60 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold w-20">Crachá</th>
              <th className="px-4 py-3 font-semibold">Pessoa</th>
              {colunaStatus && (
                <th className="px-4 py-3 font-semibold w-28">Status</th>
              )}
              <th className="px-4 py-3 font-semibold text-right w-52">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {grupo.pessoas.map((p) => (
              <tr
                key={p.id}
                className={`border-t border-pietra-clara hover:bg-pietra-clara/40${onRowClick ? " cursor-pointer" : ""}`}
                onClick={onRowClick ? () => onRowClick(p) : undefined}
              >
                <td className="px-4 py-3 font-mono text-ardesia">
                  #{p.cracha}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/pessoas/${p.id}`}
                    className="font-semibold text-carbone hover:text-verde"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.nome}
                  </Link>
                </td>
                {colunaStatus && (
                  <td className="px-4 py-3">
                    {renderStatus ? renderStatus(p) : null}
                  </td>
                )}
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderAcoes(p)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
