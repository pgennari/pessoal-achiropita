// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado.
// Criar equipes: edicao.equipeCriar. Alterar setores: setor.editar.
// Editar edicao: edicao.editar. Ativar: edicao.ativar. Dias: edicao.editar.
// Comunicacao (aba de comunicados): comunicacao.gerenciar.
// ============================================================================
import {
  FormEvent,
  MouseEvent as MouseEventReact,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useDiasFesta,
  useEquipes,
  useEdicao,
  useParticipacoes,
  usePessoas,
  useSetores,
  useComunicados,
} from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  atualizarComunicado,
  criarComunicado,
  enviarComunicado,
  removerComunicado,
  GrupoDestinatarios,
} from "../lib/comunicados";
import {
  DadosEdicaoForm,
  ativarEdicao,
  atualizarEdicao,
  encerrarEdicao,
} from "../lib/edicoes";
import {
  DadosEquipeForm,
  atualizarEquipe,
  criarEquipe,
  removerEquipe,
} from "../lib/equipes";
import {
  ErroDiaFesta,
  criarDiaFesta,
  removerDiaFesta,
} from "../lib/diasFesta";
import { EdicaoForm } from "../components/EdicaoForm";
import { EquipeForm } from "../components/EquipeForm";
import { Icone } from "../components/Icone";
import {
  DiaFesta,
  Equipe,
  SetorInfo,
  Comunicado,
  classeBadgeTipoEquipe,
  rotuloTipoEquipe,
  tipoEquipeTemBadge,
} from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

function formatarDiaFesta(data: string): string {
  const d = new Date(`${data}T00:00:00`);
  if (isNaN(d.getTime())) return data;
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)}, ${formatarData(data)}`;
}

function rotuloGrupo(grupo: string): string {
  if (grupo === "coordenadores") return "Coordenadores";
  if (grupo === "teste") return "Teste";
  return "Todos";
}

export function EdicaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const podeComunicar = temPermissao(sessao, "comunicacao.gerenciar");
  const { item: edicao, carregando, erro } = useEdicao(id);
  const { itens: equipes, carregando: carregandoEquipes } = useEquipes(id);
  const { itens: participacoes, carregando: carregandoParticipacoes } = useParticipacoes(id);
  const { itens: setores, carregando: carregandoSetores } = useSetores();
  const { itens: dias, carregando: carregandoDias } = useDiasFesta(id);
  const { itens: comunicados, carregando: carregandoComunicados } =
    useComunicados(podeComunicar ? id : undefined);
  const { itens: pessoas, carregando: carregandoPessoas } = usePessoas();

  const [editandoEdicao, setEditandoEdicao] = useState(false);
  const [criandoEquipe, setCriandoEquipe] = useState(false);
  const [filtroSetor, setFiltroSetor] = useState<string | "todos">("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [alterandoSetorId, setAlterandoSetorId] = useState<string | null>(null);
  const [criandoDia, setCriandoDia] = useState(false);
  const [novoDiaData, setNovoDiaData] = useState("");
  const [enviandoDia, setEnviandoDia] = useState(false);
  const [diaFormErro, setDiaFormErro] = useState<Record<string, string>>({});
  const [abaAtiva, setAbaAtiva] = useState<"equipes" | "dias" | "comunicacao">("equipes");
  const [criandoComunicado, setCriandoComunicado] = useState(false);
  const [novoComunicadoTitulo, setNovoComunicadoTitulo] = useState("");
  const [novoComunicadoCorpo, setNovoComunicadoCorpo] = useState("");
  const [editandoComunicadoId, setEditandoComunicadoId] = useState<string | null>(null);
  const [editandoComunicadoTitulo, setEditandoComunicadoTitulo] = useState("");
  const [editandoComunicadoCorpo, setEditandoComunicadoCorpo] = useState("");
  const [comunicadoFormErro, setComunicadoFormErro] = useState<string | null>(null);
  const [enviandoComunicado, setEnviandoComunicado] = useState(false);
  // Disparo via Brevo: por comunicado, qual grupo esta sendo enviado.
  const [comunicadoEnvio, setComunicadoEnvio] = useState<
    Record<string, GrupoDestinatarios | null>
  >({});
  const [comunicadoEnvioResultado, setComunicadoEnvioResultado] = useState<
    Record<string, { tipo: "ok" | "erro"; texto: string }>
  >({});

  // No mobile, apos rolar a lista o navegador pode sintetizar o clique no
  // cartao que ficou sob o dedo no fim do gesto (e nao no que iniciou o
  // toque), abrindo outra equipe. Guardamos onde o dedo desceu e so abrimos
  // a equipe se o clique ocorrer perto desse ponto, em gesto curto.
  const toqueRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const mapaSetor = useMemo(() => {
    const m = new Map<string, SetorInfo>();
    for (const s of setores) m.set(s.id, s);
    return m;
  }, [setores]);

  function getSetor(id: string): SetorInfo | undefined {
    return mapaSetor.get(id);
  }

  const podeEditarEdicao = temPermissao(sessao, "edicao.editar");
  const podeAtivar = temPermissao(sessao, "edicao.ativar");
  const podeCriarEquipe = temPermissao(sessao, "edicao.equipeCriar");
  const podeRemoverEquipe = temPermissao(sessao, "edicao.equipeExcluir");
  const podeAlterarSetor = temPermissao(sessao, "setor.editar");

  const alocadas = participacoes.length;

  const lista = useMemo(() => {
    const termo = filtroBusca.trim().toLowerCase();
    return equipes.filter(
      (e) =>
        (filtroSetor === "todos" || e.setor === filtroSetor) &&
        (termo === "" || e.nome.toLowerCase().includes(termo))
    );
  }, [equipes, filtroSetor, filtroBusca]);

  const comunicadoEditando = editandoComunicadoId
    ? comunicados.find((c) => c.id === editandoComunicadoId) ?? null
    : null;

  // E-mails (minusculos, sem duplicatas e ordenados) das pessoas alocadas
  // nas equipes da edicao, para gerar os mailto: da aba Comunicação.
  const emailDePessoa = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pessoas) {
      const email = p.email?.trim().toLowerCase();
      if (email) m.set(p.id, email);
    }
    return m;
  }, [pessoas]);

  const emailsAlocados = useMemo(() => {
    const set = new Set<string>();
    for (const part of participacoes) {
      const email = emailDePessoa.get(part.pessoaId);
      if (email) set.add(email);
    }
    return [...set].sort();
  }, [participacoes, emailDePessoa]);

  const emailsCoordenadores = useMemo(() => {
    const set = new Set<string>();
    for (const part of participacoes) {
      if (part.funcao !== "Coordenador") continue;
      const email = emailDePessoa.get(part.pessoaId);
      if (email) set.add(email);
    }
    return [...set].sort();
  }, [participacoes, emailDePessoa]);

  if (!sessao) return null;
  if (carregando || carregandoEquipes || carregandoParticipacoes || carregandoSetores || carregandoDias || carregandoComunicados || carregandoPessoas)
    return <p className="text-ardesia">Carregando...</p>;

  if (erro || !edicao) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Edição não encontrada</h3>
          <p className="text-ardesia">{erro ?? "Verifique o link."}</p>
          <Link
            to="/edicoes"
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

  async function handleSalvarEdicao(dados: DadosEdicaoForm) {
    if (!sessao || !edicao) return;
    await atualizarEdicao(sessao, edicao.id, dados);
    setEditandoEdicao(false);
  }

  async function handleAtivar() {
    if (!sessao || !edicao) return;
    setAcaoErro(null);
    try {
      await ativarEdicao(sessao, edicao);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao ativar.");
    }
  }

  async function handleEncerrar() {
    if (!sessao || !edicao) return;
    if (!confirm(`Encerrar a ${edicao.numero}ª edição?`)) return;
    setAcaoErro(null);
    try {
      await encerrarEdicao(sessao, edicao);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao encerrar.");
    }
  }

  async function handleCriarEquipe(dados: DadosEquipeForm) {
    if (!sessao || !edicao) return;
    await criarEquipe(sessao, edicao.id, dados, equipes);
    setCriandoEquipe(false);
  }

  async function handleRemoverEquipe(e: Equipe) {
    if (!sessao) return;
    const partsAqui = participacoes.filter((p) => p.equipeId === e.id).length;
    const aviso =
      partsAqui > 0
        ? `Esta equipe tem ${partsAqui} pessoa(s) alocada(s). Remover desfaz todas as alocações. Confirmar?`
        : `Remover a equipe "${e.nome}"?`;
    if (!confirm(aviso)) return;
    setAcaoErro(null);
    try {
      await removerEquipe(sessao, e);
    } catch (err) {
      setAcaoErro(err instanceof Error ? err.message : "Falha ao remover.");
    }
  }

  async function handleAlterarSetor(equipe: Equipe, novoSector: string) {
    if (!sessao) return;
    setAcaoErro(null);
    try {
      await atualizarEquipe(sessao, equipe, {
        nome: equipe.nome,
        setor: novoSector,
        tipo: equipe.tipo,
        equipePaiId: equipe.equipePaiId ?? null,
      }, equipes);
      setAlterandoSetorId(null);
    } catch (err) {
      setAcaoErro(err instanceof Error ? err.message : "Falha ao alterar setor.");
    }
  }

  async function handleCriarDia(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao || !edicao) return;
    setDiaFormErro({});
    setEnviandoDia(true);
    try {
      await criarDiaFesta(sessao, edicao.id, { data: novoDiaData }, dias);
      setNovoDiaData("");
      setCriandoDia(false);
    } catch (err) {
      if (err instanceof ErroDiaFesta) {
        setDiaFormErro(err.campos ?? {});
      } else {
        setDiaFormErro({
          _form: err instanceof Error ? err.message : "Falha ao cadastrar o dia.",
        });
      }
    } finally {
      setEnviandoDia(false);
    }
  }

  async function handleRemoverDia(d: DiaFesta) {
    if (!sessao) return;
    if (!confirm(`Remover o dia ${formatarDiaFesta(d.data)} desta edição?`)) return;
    setAcaoErro(null);
    try {
      await removerDiaFesta(sessao, d);
    } catch (err) {
      setAcaoErro(err instanceof Error ? err.message : "Falha ao remover.");
    }
  }

  async function handleCriarComunicado(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao || !edicao) return;
    setComunicadoFormErro(null);
    const titulo = novoComunicadoTitulo.trim();
    const corpo = novoComunicadoCorpo.trim();
    if (!titulo || !corpo) {
      setComunicadoFormErro("Preencha o título e o texto do comunicado.");
      return;
    }
    setEnviandoComunicado(true);
    try {
      await criarComunicado(edicao.id, { titulo, corpo });
      setNovoComunicadoTitulo("");
      setNovoComunicadoCorpo("");
      setCriandoComunicado(false);
    } catch (err) {
      setComunicadoFormErro(
        err instanceof Error ? err.message : "Falha ao criar o comunicado."
      );
    } finally {
      setEnviandoComunicado(false);
    }
  }

  function iniciarEdicaoComunicado(c: Comunicado) {
    setEditandoComunicadoId(c.id);
    setEditandoComunicadoTitulo(c.titulo);
    setEditandoComunicadoCorpo(c.corpo);
    setComunicadoFormErro(null);
  }

  async function handleSalvarComunicado(ev: FormEvent) {
    ev.preventDefault();
    if (!sessao || !edicao) return;
    const alvo = comunicados.find((c) => c.id === editandoComunicadoId);
    if (!alvo) return;
    setComunicadoFormErro(null);
    const titulo = editandoComunicadoTitulo.trim();
    const corpo = editandoComunicadoCorpo.trim();
    if (!titulo || !corpo) {
      setComunicadoFormErro("Preencha o título e o texto do comunicado.");
      return;
    }
    setEnviandoComunicado(true);
    try {
      await atualizarComunicado(alvo, { titulo, corpo });
      setEditandoComunicadoId(null);
    } catch (err) {
      setComunicadoFormErro(
        err instanceof Error ? err.message : "Falha ao salvar o comunicado."
      );
    } finally {
      setEnviandoComunicado(false);
    }
  }

  async function handleRemoverComunicado(c: Comunicado) {
    if (!sessao) return;
    if (!confirm(`Remover o comunicado "${c.titulo}"?`)) return;
    setComunicadoFormErro(null);
    try {
      await removerComunicado(c);
    } catch (err) {
      setComunicadoFormErro(
        err instanceof Error ? err.message : "Falha ao remover."
      );
    }
  }

  async function handleEnviarComunicado(c: Comunicado, grupo: GrupoDestinatarios) {
    const contagem =
      grupo === "coordenadores"
        ? emailsCoordenadores.length
        : grupo === "teste"
          ? ""
          : emailsAlocados.length;
    const label =
      grupo === "coordenadores"
        ? "coordenadores"
        : grupo === "teste"
          ? "e-mail de teste"
          : "pessoas alocadas";
    const avisoLimite =
      typeof contagem === "number" && contagem > 300
        ? "\n\nO servico de disparo de e-mails possui uma limitacao de 300 e-mails a cada 24hs. Todos os e-mails serao enfileirados agora, mas so serao realmente enviados em blocos de 300 a cada 24hs."
        : "";
    if (
      !confirm(
        `Enviar o comunicado "${c.titulo}" por e-mail (Brevo) para ${contagem} ${label}?${avisoLimite}`
      )
    ) {
      return;
    }
    setComunicadoEnvio((prev) => ({ ...prev, [c.id]: grupo }));
    setComunicadoEnvioResultado((prev) => ({ ...prev, [c.id]: { tipo: "ok", texto: "" } }));
    try {
      const { enviados, blocos } = await enviarComunicado(c, grupo);
      const totalBlocos = blocos.length;
      setComunicadoEnvioResultado((prev) => ({
        ...prev,
        [c.id]: {
          tipo: "ok",
          texto:
            totalBlocos > 1
              ? `Enviado para ${enviados} destinatários em ${totalBlocos} blocos (Brevo).`
              : `Enviado para ${enviados} destinatários (Brevo).`,
        },
      }));
    } catch (err) {
      setComunicadoEnvioResultado((prev) => ({
        ...prev,
        [c.id]: {
          tipo: "erro",
          texto: err instanceof Error ? err.message : "Falha ao enviar o e-mail.",
        },
      }));
    } finally {
      setComunicadoEnvio((prev) => ({ ...prev, [c.id]: null }));
    }
  }

  function abrirEquipe(equipeId: string, ev: MouseEventReact<HTMLDivElement>) {
    if (!edicao) return;
    const origem = toqueRef.current;
    toqueRef.current = null;
    const gestoCurto = origem !== null && performance.now() - origem.t < 2000;
    const semArrasto =
      origem !== null &&
      Math.hypot(ev.clientX - origem.x, ev.clientY - origem.y) <= 10;
    if (!gestoCurto || !semArrasto) return;
    navigate(`/edicoes/${edicao.id}/equipes/${equipeId}`);
  }

  if (editandoEdicao) {
    return (
      <div className="space-y-6 max-w-3xl">
        <header>
          <div className="eyebrow">Editando</div>
          <h2 className="mt-1">
            {edicao.numero}ª edição · {edicao.ano}
          </h2>
        </header>
        <div className="card">
          <div className="card-corpo">
            <EdicaoForm
              inicial={edicao}
              onSubmit={handleSalvarEdicao}
              onCancelar={() => setEditandoEdicao(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/edicoes" className="eyebrow">
            ← Edições
          </Link>
          <h2 className="mt-1">
            {edicao.numero}ª edição · {edicao.ano}
          </h2>
          <div className="text-ardesia text-sm">
            {formatarData(edicao.inicio)} – {formatarData(edicao.fim)}
            {" · "}
            {edicao.status === "ativa" && (
              <span className="badge badge-verde">Ativa</span>
            )}
            {edicao.status === "planejamento" && (
              <span className="badge badge-azul">Planejamento</span>
            )}
            {edicao.status === "encerrada" && (
              <span className="badge badge-cinza">Encerrada</span>
            )}
          </div>
        </div>
        {(podeEditarEdicao || podeAtivar) && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setEditandoEdicao(true)}
              aria-label="Editar"
              title="Editar"
            >
              <Icone nome="lapis" />
            </button>
            {edicao.status !== "ativa" && (
              <button
                type="button"
                className="btn btn-primario"
                onClick={handleAtivar}
                aria-label="Ativar"
                title="Ativar"
              >
                <Icone nome="check" />
              </button>
            )}
            {edicao.status === "ativa" && (
              <button
                type="button"
                className="btn btn-perigo"
                onClick={handleEncerrar}
                aria-label="Encerrar"
                title="Encerrar"
              >
                <Icone nome="fechar" />
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

      <section className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Equipes</div>
          <div className="kpi-valor">{equipes.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pessoas alocadas</div>
          <div className="kpi-valor">{alocadas}</div>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Seções da edição">
        <div className="tabs-lista">
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "equipes"}
            className={`aba ${abaAtiva === "equipes" ? "aba-ativa" : ""}`}
            onClick={() => setAbaAtiva("equipes")}
          >
            Equipes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === "dias"}
            className={`aba ${abaAtiva === "dias" ? "aba-ativa" : ""}`}
            onClick={() => setAbaAtiva("dias")}
          >
            Dias de festa
          </button>
          {podeComunicar && (
            <button
              type="button"
              role="tab"
              aria-selected={abaAtiva === "comunicacao"}
              className={`aba ${abaAtiva === "comunicacao" ? "aba-ativa" : ""}`}
              onClick={() => setAbaAtiva("comunicacao")}
            >
              Comunicação
            </button>
          )}
        </div>

        {abaAtiva === "equipes" && (
          <section className="tabs-painel" role="tabpanel" tabIndex={0}>
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-ardesia text-sm">
                  {carregandoEquipes
                    ? "Carregando..."
                    : `${lista.length} de ${equipes.length}`}
                </p>
                {podeCriarEquipe && !criandoEquipe && (
                  <button
                    type="button"
                    className="btn btn-primario btn-pequeno lg:hidden"
                    onClick={() => setCriandoEquipe(true)}
                    aria-label="Nova equipe"
                    title="Nova equipe"
                  >
                    <Icone nome="mais" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <input
                  type="search"
                  className="input !w-auto min-w-52"
                  placeholder="Buscar equipe por nome..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  aria-label="Buscar equipe por nome"
                />
                <div className="flex gap-1 flex-wrap">
                  <button
                    className={`filtro-chip ${
                      filtroSetor === "todos"
                        ? "filtro-chip-ativo"
                        : "filtro-chip-inativo"
                    }`}
                    onClick={() => setFiltroSetor("todos")}
                  >
                    Todos
                  </button>
                  {setores.map((s) => {
                    const ativo = filtroSetor === s.id;
                    return (
                      <button
                        key={s.id}
                        className="filtro-chip"
                        style={{
                          backgroundColor: ativo ? s.cor : `${s.cor}14`,
                          color: ativo ? "#fff" : s.cor,
                          border: ativo ? "none" : `1.5px solid ${s.cor}4d`,
                        }}
                        onClick={() => setFiltroSetor(s.id)}
                      >
                        {s.nome}
                      </button>
                    );
                  })}
                </div>
                {podeCriarEquipe && !criandoEquipe && (
                  <>
                    <div className="w-px self-stretch bg-pietra hidden lg:block" />
                    <button
                      type="button"
                      className="btn btn-primario btn-pequeno hidden lg:inline-flex"
                      onClick={() => setCriandoEquipe(true)}
                      aria-label="Nova equipe"
                      title="Nova equipe"
                    >
                      <Icone nome="mais" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {criandoEquipe && (
              <div className="card mt-4">
                <div className="card-corpo">
                  <h4 className="mb-3">Nova equipe</h4>
                  <EquipeForm
                    equipes={equipes}
                    onSubmit={handleCriarEquipe}
                    onCancelar={() => setCriandoEquipe(false)}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 mt-4">
              {lista.length === 0 && !carregandoEquipes && (
                <div className="card col-span-full">
                  <div className="card-corpo text-center text-ardesia">
                    Nenhuma equipe neste filtro.
                  </div>
                </div>
              )}
              {lista.map((e) => {
                const setorInfo = getSetor(e.setor);
                const cor = setorInfo?.cor ?? "#888";
                const equipePai = e.equipePaiId
                  ? equipes.find((eq) => eq.id === e.equipePaiId)
                  : undefined;
                return (
                  <div
                    key={e.id}
                    className="card cursor-pointer hover:shadow-media hover:-translate-y-0.5 transition-all"
                    style={{ borderLeft: `4px solid ${cor}` }}
                    onPointerDown={(ev) => {
                      toqueRef.current = {
                        x: ev.clientX,
                        y: ev.clientY,
                        t: performance.now(),
                      };
                    }}
                    onClick={(ev) => abrirEquipe(e.id, ev)}
                  >
                    <div className="card-corpo space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/edicoes/${edicao.id}/equipes/${e.id}`}
                            className="font-semibold text-carbone hover:text-verde no-underline hover:underline"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            {e.nome}
                          </Link>
                          <div className="flex items-center gap-2 flex-wrap">
                            {tipoEquipeTemBadge(e.tipo) && (
                              <span
                                className={`badge ${classeBadgeTipoEquipe(e.tipo)} shrink-0`}
                                title="Tipo de equipe"
                              >
                                {rotuloTipoEquipe(e.tipo)}
                              </span>
                            )}
                            {equipePai && (
                              <span className="text-xs text-ardesia">
                                Subordinada a {equipePai.nome}
                              </span>
                            )}
                          </div>
                        </div>
                        {alterandoSetorId === e.id && podeAlterarSetor ? (
                          <select
                            className="input !min-h-0 !py-1 !px-2 text-sm w-40"
                            value={e.setor}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={async (ev) => {
                              const novo = ev.target.value;
                              if (novo !== e.setor) {
                                await handleAlterarSetor(e, novo);
                              } else {
                                setAlterandoSetorId(null);
                              }
                            }}
                            onBlur={() => setAlterandoSetorId(null)}
                          >
                            {setores.map((s) => (
                              <option key={s.id} value={s.id}>{s.nome}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="badge shrink-0"
                            style={{
                              backgroundColor: `${cor}1f`,
                              color: cor,
                            }}
                            onClick={podeAlterarSetor ? (ev) => { ev.stopPropagation(); setAlterandoSetorId(e.id); } : undefined}
                            title={podeAlterarSetor ? "Clique para alterar setor" : undefined}
                          >
                            {setorInfo?.nome ?? e.setor}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-ardesia">Coord.: </span>
                          <span className="font-mono font-semibold">{e.vagasCoordenador}</span>
                        </div>
                        <div>
                          <span className="text-ardesia">Equip.: </span>
                          <span className="font-mono font-semibold">{e.vagasEquipista}</span>
                        </div>
                      </div>

                      {podeRemoverEquipe && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={(ev) => { ev.stopPropagation(); handleRemoverEquipe(e); }}
                            aria-label="Remover"
                            title="Remover"
                          >
                            <Icone nome="lixeira" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {abaAtiva === "dias" && (
          <section className="tabs-painel" role="tabpanel" tabIndex={0}>
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-ardesia text-sm">
                  {carregandoDias
                    ? "Carregando..."
                    : `${dias.length} dia(s) cadastrado(s)`}
                </p>
                {podeEditarEdicao && !criandoDia && (
                  <button
                    type="button"
                    className="btn btn-primario btn-pequeno"
                    onClick={() => setCriandoDia(true)}
                    aria-label="Novo dia de festa"
                    title="Novo dia de festa"
                  >
                    <Icone nome="mais" />
                  </button>
                )}
              </div>
            </div>

            {criandoDia && (
              <div className="card mt-4">
                <div className="card-corpo">
                  <h4 className="mb-3">Novo dia de festa</h4>
                  <form onSubmit={handleCriarDia} className="space-y-4">
                    {diaFormErro._form && (
                      <div className="text-sm text-vermelho-escuro">
                        {diaFormErro._form}
                      </div>
                    )}
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="input-grupo">
                        <label className="input-label" htmlFor="novo-dia">
                          Data
                        </label>
                        <input
                          id="novo-dia"
                          type="date"
                          className={`input ${diaFormErro.data ? "erro" : ""}`}
                          value={novoDiaData}
                          onChange={(e) => setNovoDiaData(e.target.value)}
                          required
                        />
                        {diaFormErro.data && (
                          <p className="input-erro-msg">{diaFormErro.data}</p>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primario"
                        disabled={enviandoDia}
                        aria-label="Salvar"
                        title="Salvar"
                      >
                        <Icone nome="check" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario"
                        onClick={() => {
                          setCriandoDia(false);
                          setDiaFormErro({});
                        }}
                        disabled={enviandoDia}
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <Icone nome="fechar" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="mt-4">
              {dias.length === 0 && !carregandoDias && (
                <div className="card">
                  <div className="card-corpo text-center text-ardesia">
                    Nenhum dia cadastrado nesta edição.
                  </div>
                </div>
              )}
              {dias.length > 0 && (
                <div className="card">
                  <div className="card-corpo divide-y divide-pietra-clara">
                    {dias.map((d, idx) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-sm bg-verde/15 text-verde-escuro flex items-center justify-center font-mono text-sm font-semibold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-carbone">
                            {formatarDiaFesta(d.data)}
                          </span>
                        </div>
                        {podeEditarEdicao && (
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={() => handleRemoverDia(d)}
                            aria-label="Remover"
                            title="Remover"
                          >
                            <Icone nome="lixeira" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {abaAtiva === "comunicacao" && podeComunicar && (
          <section className="tabs-painel" role="tabpanel" tabIndex={0}>
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-ardesia text-sm">
                  {carregandoComunicados
                    ? "Carregando..."
                    : `${comunicados.length} comunicado(s)`}
                </p>
                {!criandoComunicado && (
                  <button
                    type="button"
                    className="btn btn-primario btn-pequeno"
                    onClick={() => setCriandoComunicado(true)}
                    aria-label="Novo comunicado"
                    title="Novo comunicado"
                  >
                    <Icone nome="mais" />
                  </button>
                )}
              </div>
            </div>

            {comunicadoFormErro && (
              <div className="card border-vermelho/40 mt-4">
                <div className="card-corpo text-vermelho-escuro">
                  {comunicadoFormErro}
                </div>
              </div>
            )}

            {criandoComunicado && (
              <div className="card mt-4">
                <div className="card-corpo">
                  <h4 className="mb-3">Novo comunicado</h4>
                  <form onSubmit={handleCriarComunicado} className="space-y-4">
                    <div className="input-grupo">
                      <label className="input-label" htmlFor="novo-comunicado-titulo">
                        Título
                      </label>
                      <input
                        id="novo-comunicado-titulo"
                        type="text"
                        className="input"
                        value={novoComunicadoTitulo}
                        onChange={(e) => setNovoComunicadoTitulo(e.target.value)}
                        maxLength={120}
                        required
                      />
                    </div>
                    <div className="input-grupo">
                      <label className="input-label" htmlFor="novo-comunicado-corpo">
                        Texto
                      </label>
                      <textarea
                        id="novo-comunicado-corpo"
                        className="input min-h-28"
                        value={novoComunicadoCorpo}
                        onChange={(e) => setNovoComunicadoCorpo(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="btn btn-primario"
                        disabled={enviandoComunicado}
                        aria-label="Salvar"
                        title="Salvar"
                      >
                        <Icone nome="check" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario"
                        onClick={() => {
                          setCriandoComunicado(false);
                          setComunicadoFormErro(null);
                        }}
                        disabled={enviandoComunicado}
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <Icone nome="fechar" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {comunicadoEditando && (
              <div className="card mt-4">
                <div className="card-corpo">
                  <h4 className="mb-3">Editar comunicado</h4>
                  <form onSubmit={handleSalvarComunicado} className="space-y-4">
                    <div className="input-grupo">
                      <label className="input-label" htmlFor="editar-comunicado-titulo">
                        Título
                      </label>
                      <input
                        id="editar-comunicado-titulo"
                        type="text"
                        className="input"
                        value={editandoComunicadoTitulo}
                        onChange={(e) => setEditandoComunicadoTitulo(e.target.value)}
                        maxLength={120}
                        required
                      />
                    </div>
                    <div className="input-grupo">
                      <label className="input-label" htmlFor="editar-comunicado-corpo">
                        Texto
                      </label>
                      <textarea
                        id="editar-comunicado-corpo"
                        className="input min-h-28"
                        value={editandoComunicadoCorpo}
                        onChange={(e) => setEditandoComunicadoCorpo(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="btn btn-primario"
                        disabled={enviandoComunicado}
                        aria-label="Salvar"
                        title="Salvar"
                      >
                        <Icone nome="check" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario"
                        onClick={() => {
                          setEditandoComunicadoId(null);
                          setComunicadoFormErro(null);
                        }}
                        disabled={enviandoComunicado}
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <Icone nome="fechar" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {comunicados.length === 0 && !carregandoComunicados && (
                <div className="card">
                  <div className="card-corpo text-center text-ardesia">
                    Nenhum comunicado publicado nesta edição.
                  </div>
                </div>
              )}
              {comunicados.map((c) => (
                <div key={c.id} className="card">
                  <div className="card-corpo space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold text-carbone min-w-0">
                        {c.titulo}
                      </h4>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          className="btn btn-texto btn-pequeno"
                          onClick={() => iniciarEdicaoComunicado(c)}
                          aria-label="Editar"
                          title="Editar"
                        >
                          <Icone nome="lapis" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-texto btn-pequeno text-vermelho-escuro"
                          onClick={() => handleRemoverComunicado(c)}
                          aria-label="Remover"
                          title="Remover"
                        >
                          <Icone nome="lixeira" />
                        </button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-carbone">
                      {c.corpo}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ardesia">
                        Enviar por e-mail
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-sm border-[1.5px] border-carbone bg-bianco px-2.5 py-1 font-sans font-semibold text-xs text-carbone transition h-8 hover:bg-carbone hover:text-white disabled:opacity-45 disabled:pointer-events-none"
                        onClick={() => handleEnviarComunicado(c, "todos")}
                        disabled={comunicadoEnvio[c.id] !== undefined && comunicadoEnvio[c.id] !== null}
                        aria-label={`Enviar por e-mail para todos (${emailsAlocados.length})`}
                        title={`Enviar para pessoas alocadas (${emailsAlocados.length})`}
                      >
                        {comunicadoEnvio[c.id] === "todos"
                          ? "Enviando..."
                          : `Todos (${emailsAlocados.length})`}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-sm border-[1.5px] border-carbone bg-bianco px-2.5 py-1 font-sans font-semibold text-xs text-carbone transition h-8 hover:bg-carbone hover:text-white disabled:opacity-45 disabled:pointer-events-none"
                        onClick={() => handleEnviarComunicado(c, "coordenadores")}
                        disabled={comunicadoEnvio[c.id] !== undefined && comunicadoEnvio[c.id] !== null}
                        aria-label={`Enviar por e-mail para coordenadores (${emailsCoordenadores.length})`}
                        title={`Enviar para coordenadores (${emailsCoordenadores.length})`}
                      >
                        {comunicadoEnvio[c.id] === "coordenadores"
                          ? "Enviando..."
                          : `Coordenadores (${emailsCoordenadores.length})`}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-sm border-[1.5px] border-marrone bg-bianco px-2.5 py-1 font-sans font-semibold text-xs text-marrone transition h-8 hover:bg-marrone hover:text-white disabled:opacity-45 disabled:pointer-events-none"
                        onClick={() => handleEnviarComunicado(c, "teste")}
                        disabled={comunicadoEnvio[c.id] !== undefined && comunicadoEnvio[c.id] !== null}
                        aria-label="Enviar comunicado de teste por e-mail"
                        title="Enviar para o e-mail de teste configurado"
                      >
                        {comunicadoEnvio[c.id] === "teste" ? "Enviando..." : "Teste"}
                      </button>
                      {comunicadoEnvioResultado[c.id]?.texto && (
                        <span
                          className={`text-xs font-medium ${
                            comunicadoEnvioResultado[c.id].tipo === "ok"
                              ? "text-verde-escuro"
                              : "text-vermelho-escuro"
                          }`}
                        >
                          {comunicadoEnvioResultado[c.id].texto}
                        </span>
                      )}
                    </div>
                    {c.disparos.length > 0 && (
                      <div className="rounded-sm border border-ardesia/20 bg-ardesia/5 px-3 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ardesia">
                          Histórico de disparos
                        </span>
                        <ul className="mt-1 space-y-0.5">
                          {c.disparos.map((d) => (
                            <li
                              key={d.id}
                              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-carbone/80"
                            >
                              <span className="font-semibold text-carbone">
                                {rotuloGrupo(d.grupo)}
                              </span>
                              <span>bloco {d.bloco}</span>
                              <span>·</span>
                              <span>{d.destinatarios} destinatários</span>
                              <span>·</span>
                              <span>
                                {new Date(d.criadoEm).toLocaleString("pt-BR")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="text-xs text-ardesia">
                      {c.autorNome} · {new Date(c.criadoEm).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => navigate("/edicoes")}
          aria-label="Voltar"
          title="Voltar"
        >
          <Icone nome="seta-esquerda" />
        </button>
      </div>
    </div>
  );
}
