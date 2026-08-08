// ============================================================================
// CONTROLE DE PERMISSAO
// Ver lista: usuario.lista. Enviar/editar convite: usuario.conviteEnviar.
// Revogar convite: usuario.conviteRevogar. Editar usuario: usuario.editar.
// Excluir usuario/convite: usuario.excluir.
// ============================================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  useEquipes,
  useConvites,
  useEdicaoAtiva,
  usePessoas,
  useUsuarios,
} from "../lib/hooks";
import { usePerfis } from "../lib/hooks";
import {
  DadosUsuarioForm,
  atualizarUsuario,
  removerUsuario,
} from "../lib/usuarios";
import {
  CriarConviteResultado,
  DadosConviteForm,
  atualizarConvite,
  criarConvite,
  normalizarEmail,
  removerConvite,
  revogarConvite,
  urlPublicaConvite,
} from "../lib/convites";
import { UsuarioForm } from "../components/UsuarioForm";
import { ConviteForm } from "../components/ConviteForm";
import { Icone } from "../components/Icone";
import { Convite, StatusConvite, Usuario } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

type Aba = "usuarios" | "convites";

const STATUS_CONVITE_FILTRO: Array<{ valor: StatusConvite | ""; rotulo: string }> = [
  { valor: "", rotulo: "Todos os status" },
  { valor: "pendente", rotulo: "Pendente" },
  { valor: "usado", rotulo: "Usado" },
  { valor: "revogado", rotulo: "Revogado" },
];

function classePerfilBadge(p: string): string {
  if (p === "ADM") return "badge badge-vermelho";
  if (p === "ORG") return "badge badge-ouro";
  if (p === "CRD") return "badge badge-azul";
  return "badge badge-cinza";
}

function classeStatusBadge(s: StatusConvite): string {
  if (s === "pendente") return "badge badge-ouro";
  if (s === "usado") return "badge badge-verde";
  return "badge badge-cinza";
}

export function Usuarios() {
  const { sessao } = useSessao();
  const { itens: usuarios, carregando } = useUsuarios();
  const { itens: convites, carregando: carregandoConvites } = useConvites();
  const { itens: pessoas } = usePessoas();
  const { edicao } = useEdicaoAtiva();
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: perfis } = usePerfis();

  const rotuloPerfil = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of perfis) m.set(p.sigla, p.sigla);
    return m;
  }, [perfis]);

  const [aba, setAba] = useState<Aba>("usuarios");
  const [editandoUid, setEditandoUid] = useState<string | null>(null);
  const [editandoConviteId, setEditandoConviteId] = useState<string | null>(null);
  const [criandoConvite, setCriandoConvite] = useState(false);
  const [linkRecemCriado, setLinkRecemCriado] = useState<CriarConviteResultado | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  // Filtros da aba Usuários
  const [filtroUsuario, setFiltroUsuario] = useState("");

  // Filtros da aba Convites
  const [filtroConviteEmail, setFiltroConviteEmail] = useState("");
  const [filtroConvitePerfil, setFiltroConvitePerfil] = useState("");
  const [filtroConviteStatus, setFiltroConviteStatus] = useState<StatusConvite | "">("");

  const indicePessoas = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pessoas) m.set(p.id, `#${p.cracha} ${p.nome}`);
    return m;
  }, [pessoas]);

  const emailsEmUso = useMemo(
    () => new Set(usuarios.map((u) => u.email.toLowerCase())),
    [usuarios]
  );

  const emailsPendentes = useMemo(
    () =>
      new Set(
        convites
          .filter((c) => c.status === "pendente")
          .map((c) => c.email.toLowerCase())
      ),
    [convites]
  );

  const siglasPerfis = useMemo(
    () => new Set(perfis.map((p) => p.sigla)),
    [perfis]
  );

  const listaUsuarios = useMemo(() => {
    const t = filtroUsuario.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t) ||
        u.perfil.toLowerCase() === t
    );
  }, [usuarios, filtroUsuario]);

  const listaConvites = useMemo(() => {
    return convites.filter((c) => {
      if (filtroConviteEmail && !c.email.includes(filtroConviteEmail.toLowerCase().trim()))
        return false;
      if (filtroConvitePerfil && c.perfil !== filtroConvitePerfil) return false;
      if (filtroConviteStatus && c.status !== filtroConviteStatus) return false;
      return true;
    });
  }, [convites, filtroConviteEmail, filtroConvitePerfil, filtroConviteStatus]);

  const convitesPendentes = useMemo(
    () => convites.filter((c) => c.status === "pendente"),
    [convites]
  );

  if (!sessao) return null;
  const podeListar = temPermissao(sessao, "usuario.lista");
  const podeEditar = temPermissao(sessao, "usuario.editar");
  const podeExcluir = temPermissao(sessao, "usuario.excluir");
  const podeRevogar = temPermissao(sessao, "usuario.conviteRevogar");
  const podeEditarConvite = temPermissao(sessao, "usuario.conviteEnviar");
  if (!podeListar) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração e Organização gerenciam usuários.
          </p>
          <Link
            to="/"
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

  const usuarioEditando = usuarios.find((u) => u.uid === editandoUid) ?? null;
  const conviteEditando = convites.find((c) => c.id === editandoConviteId) ?? null;

  async function handleCriarConvite(dados: DadosConviteForm) {
    if (!sessao) return;
    const emailNorm = normalizarEmail(dados.email);
    const resultado = await criarConvite(sessao, dados, {
      emailEmUso: emailsEmUso.has(emailNorm),
      pendenteParaEmail: emailsPendentes.has(emailNorm),
    }, siglasPerfis);
    setCriandoConvite(false);
    setLinkRecemCriado(resultado);
  }

  async function handleAtualizarConvite(dados: DadosConviteForm) {
    if (!sessao || !conviteEditando) return;
    await atualizarConvite(sessao, conviteEditando.id, dados, siglasPerfis);
    setEditandoConviteId(null);
  }

  async function handleAtualizarUsuario(dados: DadosUsuarioForm) {
    if (!sessao || !usuarioEditando) return;
    await atualizarUsuario(sessao, usuarioEditando.uid, dados, siglasPerfis);
    setEditandoUid(null);
  }

  async function handleRemoverUsuario(u: Usuario) {
    if (!sessao) return;
    if (u.uid === sessao.uid) {
      setAcaoErro("Você não pode remover o próprio usuário.");
      return;
    }
    if (
      !confirm(
        `Remover ${u.nome} (${u.email})? A conta no Firebase Authentication permanece; desabilite por lá se quiser bloquear o login.`
      )
    )
      return;
    setAcaoErro(null);
    try {
      await removerUsuario(sessao, u);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  async function handleRevogarConvite(c: Convite) {
    if (!sessao) return;
    if (!confirm(`Revogar o convite para ${c.email}?`)) return;
    setAcaoErro(null);
    try {
      await revogarConvite(sessao, c);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao revogar.");
    }
  }

  async function handleRemoverConvite(c: Convite) {
    if (!sessao) return;
    if (!confirm(`Apagar o convite para ${c.email} do histórico?`)) return;
    setAcaoErro(null);
    try {
      await removerConvite(sessao, c);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao apagar.");
    }
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(urlPublicaConvite(token));
    } catch {
      setAcaoErro("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  const podeAbrirNovo =
    podeEditarConvite && !criandoConvite && !editandoConviteId && !editandoUid;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Administração</div>
          <h2 className="mt-1">Usuários e Convites</h2>
          <p className="text-ardesia text-sm">
            {carregando
              ? "Carregando..."
              : `${usuarios.length} usuário(s) · ${convitesPendentes.length} convite(s) pendente(s)`}
          </p>
        </div>
        {podeAbrirNovo && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => {
              setAba("convites");
              setCriandoConvite(true);
            }}
            aria-label="Novo convite"
            title="Novo convite"
          >
            <Icone nome="mais" />
          </button>
        )}
      </header>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia">
          ADM ou ORG geram um convite e enviam o link ao novo usuário.
          Quem entra no sistema <strong>precisa ter passado pelo link</strong>;
          tentativas de login sem convite são recusadas e mostram um aviso
          orientando a procurar a organização.
        </div>
      </div>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      {linkRecemCriado && (
        <div className="card border-verde/40">
          <div className="card-corpo space-y-3">
            <h3 className="m-0">Convite criado</h3>
            <p className="text-ardesia text-sm">
              Copie o link abaixo e envie ao novo usuário. Ele tem 7 dias para
              completar o cadastro.
            </p>
            <code className="block bg-pietra-clara/60 rounded-sm px-2 py-2 text-xs break-all">
              {linkRecemCriado.url}
            </code>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primario btn-pequeno"
                onClick={() => copiar(linkRecemCriado.token)}
                aria-label="Copiar link"
                title="Copiar link"
              >
                <Icone nome="copiar" />
              </button>
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={() => setLinkRecemCriado(null)}
                aria-label="Fechar"
                title="Fechar"
              >
                <Icone nome="fechar" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="tabs">
        <div className="tabs-lista">
          <button
            type="button"
            className={`aba ${aba === "usuarios" ? "aba-ativa" : ""}`}
            onClick={() => setAba("usuarios")}
          >
            Usuários
            <span className="ml-1 text-xs font-normal text-ardesia">
              ({usuarios.length})
            </span>
          </button>
          <button
            type="button"
            className={`aba ${aba === "convites" ? "aba-ativa" : ""}`}
            onClick={() => setAba("convites")}
          >
            Convites
            {convitesPendentes.length > 0 && (
              <span className="ml-1 badge badge-ouro text-xs">
                {convitesPendentes.length}
              </span>
            )}
          </button>
        </div>

        {/* Aba Usuários */}
        {aba === "usuarios" && (
          <section className="space-y-4 tabs-painel">
            {editandoUid && usuarioEditando && (
              <div className="card">
                <div className="card-corpo">
                  <h3 className="mb-4">Editando {usuarioEditando.nome}</h3>
                  <UsuarioForm
                    inicial={usuarioEditando}
                    pessoas={pessoas}
                    equipesAtivas={equipes}
                    onSubmit={handleAtualizarUsuario}
                    onCancelar={() => setEditandoUid(null)}
                  />
                </div>
              </div>
            )}
  
            <div className="card">
              <div className="card-corpo">
                <input
                  className="input"
                  placeholder="Buscar por nome, e-mail ou perfil..."
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                />
              </div>
            </div>
  
            <div className="card overflow-hidden">
              <div className="tabela-rolavel">
                <table className="tabela-larga">
                  <thead className="bg-pietra-clara/60 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nome / e-mail</th>
                      <th className="px-4 py-3 font-semibold w-24">Perfil</th>
                      <th className="px-4 py-3 font-semibold hidden md:table-cell">
                        Vinculada a
                      </th>
                      <th className="px-4 py-3 font-semibold hidden lg:table-cell w-36">
                        Criado em
                      </th>
                      <th className="px-4 py-3 font-semibold w-44 text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaUsuarios.length === 0 && !carregando && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-ardesia"
                        >
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    )}
                    {listaUsuarios.map((u) => (
                      <tr
                        key={u.uid}
                        className="border-t border-pietra-clara hover:bg-pietra-clara/40 cursor-pointer"
                        onClick={() => {
                          setEditandoConviteId(null);
                          setEditandoUid(u.uid);
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold">{u.nome}</div>
                          <div className="text-xs text-ardesia font-mono">
                            {u.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={classePerfilBadge(u.perfil)}>
                            {rotuloPerfil.get(u.perfil) ?? u.perfil}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-ardesia">
                          {u.pessoaId
                            ? indicePessoas.get(u.pessoaId) ?? "(pessoa removida)"
                            : "—"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-ardesia font-mono text-xs">
                          {formatarData(u.criadoEm)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {podeEditar && (
                            <button
                              type="button"
                              className="btn btn-secundario btn-pequeno"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setEditandoConviteId(null);
                                setEditandoUid(u.uid);
                              }}
                              aria-label="Editar"
                              title="Editar"
                            >
                              <Icone nome="lapis" />
                            </button>
                            )}
                            {podeExcluir && (
                              <button
                                type="button"
                                className="btn btn-texto btn-pequeno text-vermelho-escuro"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleRemoverUsuario(u);
                                }}
                                disabled={u.uid === sessao.uid}
                                aria-label="Remover"
                                title={
                                  u.uid === sessao.uid
                                    ? "Não pode remover o próprio usuário"
                                    : "Remover"
                                }
                              >
                                <Icone nome="lixeira" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Aba Convites */}
        {aba === "convites" && (
          <section className="space-y-4 tabs-painel">
            {criandoConvite && (
              <div className="card">
                <div className="card-corpo">
                  <h3 className="mb-4">Novo convite</h3>
                  <ConviteForm
                    pessoas={pessoas}
                    equipesAtivas={equipes}
                    onSubmit={handleCriarConvite}
                    onCancelar={() => setCriandoConvite(false)}
                  />
                </div>
              </div>
            )}
  
            {editandoConviteId && conviteEditando && (
              <div className="card">
                <div className="card-corpo">
                  <h3 className="mb-4">
                    Editando convite — {conviteEditando.email}
                  </h3>
                  <ConviteForm
                    inicial={conviteEditando}
                    pessoas={pessoas}
                    equipesAtivas={equipes}
                    onSubmit={handleAtualizarConvite}
                    onCancelar={() => setEditandoConviteId(null)}
                  />
                </div>
              </div>
            )}
  
            {/* Filtros */}
            <div className="card">
              <div className="card-corpo">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    className="input"
                    placeholder="Filtrar por e-mail..."
                    value={filtroConviteEmail}
                    onChange={(e) => setFiltroConviteEmail(e.target.value)}
                  />
                  <select
                    className="input"
                    value={filtroConvitePerfil}
                    onChange={(e) =>
                      setFiltroConvitePerfil(e.target.value)
                    }
                  >
                    <option value="">Todos os perfis</option>
                    {perfis.map((p) => (
                      <option key={p.sigla} value={p.sigla}>
                        {p.sigla}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={filtroConviteStatus}
                    onChange={(e) =>
                      setFiltroConviteStatus(e.target.value as StatusConvite | "")
                    }
                  >
                    {STATUS_CONVITE_FILTRO.map((s) => (
                      <option key={s.valor} value={s.valor}>
                        {s.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
  
            {/* Tabela de convites */}
            <div className="card overflow-hidden">
              <div className="tabela-rolavel">
                <table className="tabela-larga">
                  <thead className="bg-pietra-clara/60 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold">E-mail</th>
                      <th className="px-4 py-3 font-semibold w-24">Perfil</th>
                      <th className="px-4 py-3 font-semibold w-28">Status</th>
                      <th className="px-4 py-3 font-semibold hidden lg:table-cell w-36">
                        Criado em
                      </th>
                      <th className="px-4 py-3 font-semibold hidden lg:table-cell w-36">
                        Expira em
                      </th>
                      <th className="px-4 py-3 font-semibold w-56 text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {carregandoConvites && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-ardesia">
                          Carregando...
                        </td>
                      </tr>
                    )}
                    {!carregandoConvites && listaConvites.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-ardesia">
                          Nenhum convite encontrado.
                        </td>
                      </tr>
                    )}
                    {listaConvites.map((c) => (
                      <tr
                        key={c.id}
                        className={`border-t border-pietra-clara hover:bg-pietra-clara/40${c.status === "pendente" ? " cursor-pointer" : ""}`}
                        onClick={() => {
                          if (c.status === "pendente") {
                            setEditandoUid(null);
                            setEditandoConviteId(c.id);
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{c.email}</td>
                        <td className="px-4 py-3">
                          <span className={classePerfilBadge(c.perfil)}>
                            {rotuloPerfil.get(c.perfil) ?? c.perfil}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={classeStatusBadge(c.status)}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-ardesia font-mono text-xs">
                          {formatarData(c.criadoEm)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-ardesia font-mono text-xs">
                          {formatarData(c.expiraEm)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {c.status === "pendente" && (
                              <button
                                type="button"
                                className="btn btn-secundario btn-pequeno"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  copiar(c.id);
                                }}
                                aria-label="Copiar link"
                                title="Copiar link"
                              >
                                <Icone nome="copiar" />
                              </button>
                            )}
                            {c.status === "pendente" && podeEditarConvite && (
                              <button
                                type="button"
                                className="btn btn-secundario btn-pequeno"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setEditandoUid(null);
                                  setEditandoConviteId(c.id);
                                }}
                                aria-label="Editar"
                                title="Editar"
                              >
                                <Icone nome="lapis" />
                              </button>
                            )}
                            {c.status === "pendente" && podeRevogar && (
                              <button
                                type="button"
                                className="btn btn-texto btn-pequeno text-vermelho-escuro"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleRevogarConvite(c);
                                }}
                                aria-label="Revogar"
                                title="Revogar"
                              >
                                <Icone nome="proibido" />
                              </button>
                            )}
                            {c.status !== "pendente" && podeExcluir && (
                              <button
                                type="button"
                                className="btn btn-texto btn-pequeno text-vermelho-escuro"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleRemoverConvite(c);
                                }}
                                aria-label="Apagar"
                                title="Apagar"
                              >
                                <Icone nome="lixeira" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
