import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useEquipes,
  useEdicaoAtiva,
  useFormacoes,
  useLinksEdicao,
  useParticipacoes,
  usePessoas,
  useTurmasFormacao,
} from "../lib/hooks";
import {
  ErroFormacao,
  confirmarDadosManual,
  marcarPresencaManual,
  removerFormacao,
} from "../lib/formacoes";
import { gerarLinkDeTurma } from "../lib/links";
import { urlPublica } from "../lib/links";
import {
  Equipe,
  Formacao,
  FUNCOES,
  Funcao,
  LinkValidacao,
  Participacao,
  Pessoa,
  Setor,
  TurmaFormacao,
} from "../lib/tipos";
import { formatarData, normalizar, soDigitos } from "../lib/utilsDominio";

// --- tipos auxiliares ---

interface GrupoEquipe {
  equipeId: string;
  equipeNome: string;
  setor: Setor;
  pessoas: Pessoa[];
}

const SECAO_SEM_FORMACAO = "sem-formacao";
const SECAO_AGUARDANDO_VALIDACAO = "aguardando-validacao";
const SECAO_CONFIRMADOS = "confirmados";

function agruparPorEquipe(
  pessoas: Pessoa[],
  indiceParticipacao: Map<string, Participacao>,
  indiceEquipe: Map<string, Equipe>
): GrupoEquipe[] {
  const grupos = new Map<string, GrupoEquipe>();
  for (const p of pessoas) {
    const part = indiceParticipacao.get(p.id);
    if (!part) continue;
    const equipe = indiceEquipe.get(part.equipeId);
    if (!equipe) continue;
    if (!grupos.has(part.equipeId)) {
      grupos.set(part.equipeId, {
        equipeId: part.equipeId,
        equipeNome: equipe.nome,
        setor: equipe.setor,
        pessoas: [],
      });
    }
    grupos.get(part.equipeId)!.pessoas.push(p);
  }
  return [...grupos.values()].sort((a, b) =>
    a.equipeNome.localeCompare(b.equipeNome, "pt-BR")
  );
}

function rotuloSetor(s: Setor): string {
  return s === "Alimentacao" ? "Alimentação" : s;
}

function rolarParaSecao(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

// --- componente principal ---

export function PendenciasFormacao() {
  const { sessao } = useSessao();
  const { edicao, carregando: carregandoEdicao } = useEdicaoAtiva();
  const navigate = useNavigate();
  const { itens: turmas } = useTurmasFormacao(edicao?.id);
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: formacoes } = useFormacoes(edicao?.id);
  const { itens: pessoas } = usePessoas();
  const { itens: linksEdicao } = useLinksEdicao(edicao?.id);

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
  const [filtroEquipe, setFiltroEquipe] = useState("");
  const [filtroFuncao, setFiltroFuncao] = useState<Funcao | "">("");
  const [mostrarTopo, setMostrarTopo] = useState(false);

  useEffect(() => {
    function aoRolar() {
      setMostrarTopo(window.scrollY > 400);
    }
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  function voltarAoTopo() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const podeAdministrar =
    !!sessao && (sessao.perfil === "ADM" || sessao.perfil === "ORG");

  const podeConfirmarDados =
    !!sessao &&
    (sessao.perfil === "ADM" ||
      sessao.perfil === "ORG" ||
      sessao.perfil === "OPC");

  const podeAcessar = podeConfirmarDados || sessao?.perfil === "CRD";

  // Índices derivados ---

  const indiceParticipacaoPorPessoa = useMemo(() => {
    const m = new Map<string, Participacao>();
    for (const p of participacoes) m.set(p.pessoaId, p);
    return m;
  }, [participacoes]);

  const indiceEquipeById = useMemo(() => {
    const m = new Map<string, Equipe>();
    for (const e of equipes) m.set(e.id, e);
    return m;
  }, [equipes]);

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

  // Alocados após filtros de busca, equipe e função (US-06-04)
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

      if (filtroEquipe) {
        if (!part || part.equipeId !== filtroEquipe) return false;
      }

      return true;
    });
  }, [
    alocados,
    busca,
    filtroEquipe,
    filtroFuncao,
    indiceParticipacaoPorPessoa,
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

  // Agrupamentos por equipe para Lista A e Lista B
  const gruposSemFormacao = useMemo(
    () =>
      agruparPorEquipe(
        semFormacao,
        indiceParticipacaoPorPessoa,
        indiceEquipeById
      ),
    [semFormacao, indiceParticipacaoPorPessoa, indiceEquipeById]
  );

  const gruposPendentesValidacao = useMemo(
    () =>
      agruparPorEquipe(
        pendentesValidacao,
        indiceParticipacaoPorPessoa,
        indiceEquipeById
      ),
    [pendentesValidacao, indiceParticipacaoPorPessoa, indiceEquipeById]
  );

  const totalPresencas = formacoes.length;
  const pctPresencas =
    alocados.length > 0
      ? Math.round((totalPresencas / alocados.length) * 100)
      : 0;

  const atalhosPendencias = [
    {
      id: SECAO_SEM_FORMACAO,
      titulo: "SEM FORMAÇÃO",
      descricao: "Pessoas alocadas que ainda não registraram presença.",
      quantidade: semFormacao.length,
      classeBadge: "badge-cinza",
    },
    {
      id: SECAO_AGUARDANDO_VALIDACAO,
      titulo: "Aguardando validação de dados",
      descricao: "Presenças manuais que ainda dependem de confirmação.",
      quantidade: pendentesValidacao.length,
      classeBadge: "badge-ouro",
    },
    {
      id: SECAO_CONFIRMADOS,
      titulo: "Confirmados",
      descricao: "Pessoas com presença e dados já validados.",
      quantidade: confirmados.length,
      classeBadge: "badge-verde",
    },
  ];

  if (!sessao) return null;
  if (!podeAcessar) {
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
            Marque uma edição como ativa para ver pendências de formação.
          </p>
          <Link to="/edicoes" className="btn btn-primario mt-4">
            Abrir edições
          </Link>
        </div>
      </div>
    );
  }

  // --- handlers ---

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
    const equipe = part ? indiceEquipeById.get(part.equipeId) : undefined;
    const pessoaNome = equipe?.nome ?? f.pessoaId;
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
        <h2 className="mt-1">Pendências de Formação</h2>
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

      {/* Filtros de pendências (US-06-04) */}
      <section className="space-y-4">
        <div>
          <p className="text-ardesia text-sm">
            Use os filtros para localizar e acompanhar as pendências por equipe
            ou função.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {atalhosPendencias.map((atalho) => (
              <button
                key={atalho.id}
                type="button"
                onClick={() => rolarParaSecao(atalho.id)}
                className={`badge ${atalho.classeBadge} cursor-pointer hover:opacity-75 transition-opacity`}
              >
                {atalho.titulo}
                <span className="font-bold ml-1">{atalho.quantidade}</span>
              </button>
            ))}
          </div>
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
                value={filtroEquipe}
                onChange={(e) => setFiltroEquipe(e.target.value)}
              >
                <option value="">Todas as equipes</option>
                {equipes.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome}
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
        <div id={SECAO_SEM_FORMACAO} className="scroll-mt-6">
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
                  key={grupo.equipeId}
                  grupo={grupo}
                  colunaStatus={false}
                  onRowClick={podeConfirmarDados ? (p) => {
                    setMarcandoPara({ pessoa: p });
                    setJustificativa("");
                  } : undefined}
                  renderAcoes={podeConfirmarDados ? (p) => (
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
                  ) : () => null}
                />
              ))}
            </div>
          )}
        </div>

        {/* Lista B — Aguardando validação de dados */}
        <div id={SECAO_AGUARDANDO_VALIDACAO} className="scroll-mt-6">
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
                  key={grupo.equipeId}
                  grupo={grupo}
                  colunaStatus
                  onRowClick={(p) => navigate(`/pessoas/${p.id}`)}
                  renderStatus={(p) => {
                    const f = indiceFormacoes.get(p.id);
                    if (!f) return null;
                    return (
                      <button
                        type="button"
                        className="badge badge-ouro hover:underline cursor-pointer"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setVendoJustificativa({ formacao: f, pessoa: p });
                        }}
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
                            onClick={(ev) => { ev.stopPropagation(); handleConfirmarDados(f, p); }}
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
                            onClick={(ev) => {
                              ev.stopPropagation();
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
                            onClick={(ev) => { ev.stopPropagation(); handleRemoverFormacao(f); }}
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
        <div id={SECAO_CONFIRMADOS} className="scroll-mt-6">
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
                      <th className="px-4 py-3 font-semibold">Equipe</th>
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
                      const equipe = part
                        ? indiceEquipeById.get(part.equipeId)
                        : undefined;
                      return (
                        <tr
                          key={p.id}
                          className="border-t border-pietra-clara hover:bg-pietra-clara/40 cursor-pointer"
                          onClick={() => navigate(`/pessoas/${p.id}`)}
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
                            {equipe?.nome ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="badge badge-verde">validado</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {podeAdministrar && f && (
                              <button
                                type="button"
                                className="btn btn-texto btn-pequeno text-vermelho-escuro"
                                onClick={(ev) => { ev.stopPropagation(); handleRemoverFormacao(f); }}
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
                    turmas na página de Formação.
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

      {mostrarTopo && (
        <button
          type="button"
          onClick={voltarAoTopo}
          className="fixed bottom-6 right-6 z-40 btn btn-primario btn-pequeno rounded-full shadow-media"
          aria-label="Voltar ao topo"
        >
          ↑ Topo
        </button>
      )}
    </div>
  );
}

// --- componente auxiliar para tabela por equipe ---

interface GrupoEquipeTabelaProps {
  grupo: GrupoEquipe;
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
}: GrupoEquipeTabelaProps) {
  return (
    <div className="card overflow-hidden">
      <div className="card-corpo flex flex-wrap items-center gap-3 border-b border-pietra-clara py-3">
        <span className="font-semibold">{grupo.equipeNome}</span>
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
