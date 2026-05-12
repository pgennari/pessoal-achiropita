import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useBarracas,
  useConvites,
  useEdicaoAtiva,
  usePessoas,
  useUsuarios,
} from "../lib/hooks";
import {
  DadosUsuarioForm,
  atualizarUsuario,
  criarUsuarioPorAdm,
  removerUsuario,
} from "../lib/usuarios";
import { DadosCriarConvite, criarConvite } from "../lib/convites";
import { UsuarioForm } from "../components/UsuarioForm";
import { ConviteForm } from "../components/ConviteForm";
import { Usuario } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

type Aba = "usuarios" | "convites";

const ROTULO_PERFIL: Record<string, string> = {
  ADM: "ADM",
  ORG: "ORG",
  CRD: "CRD",
  EQP: "EQP",
  OPC: "OPC",
  REC: "REC",
};

function AbaBtn({
  ativa,
  children,
  onClick,
}: {
  ativa: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`px-5 py-2.5 text-sm font-semibold rounded-sm transition ${
        ativa
          ? "bg-verde text-white shadow-media"
          : "bg-bianco text-carbone border border-pietra hover:bg-pietra-clara"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Usuarios() {
  const { sessao } = useSessao();
  const { itens: usuarios, carregando, erro } = useUsuarios();
  const { itens: convites, carregando: convitesCarregando } = useConvites();
  const { itens: pessoas } = usePessoas();
  const { edicao } = useEdicaoAtiva();
  const { itens: barracas } = useBarracas(edicao?.id);
  const [aba, setAba] = useState<Aba>("usuarios");
  const [editandoUid, setEditandoUid] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [convidando, setConvidando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [filtroConvite, setFiltroConvite] = useState("");
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const indicePessoas = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pessoas) m.set(p.id, `#${p.cracha} ${p.nome}`);
    return m;
  }, [pessoas]);

  const lista = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t) ||
        u.perfil.toLowerCase() === t
    );
  }, [usuarios, filtro]);

  if (!sessao) return null;
  if (sessao.perfil !== "ADM") {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração pode gerenciar usuários.
          </p>
          <Link to="/" className="btn btn-secundario mt-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const usuarioEditando = usuarios.find((u) => u.uid === editandoUid) ?? null;

  async function handleCriar(dados: DadosUsuarioForm) {
    if (!sessao) return;
    await criarUsuarioPorAdm(sessao, dados);
    setCriando(false);
  }

  async function handleAtualizar(dados: DadosUsuarioForm) {
    if (!sessao || !usuarioEditando) return;
    await atualizarUsuario(sessao, usuarioEditando.uid, dados);
    setEditandoUid(null);
  }

  async function handleConvidar(dados: DadosCriarConvite): Promise<string> {
    return await criarConvite(sessao!, dados);
  }

  async function handleRemover(u: Usuario) {
    if (!sessao) return;
    if (u.uid === sessao.uid) {
      setAcaoErro("Você não pode remover o próprio usuário.");
      return;
    }
    if (
      !confirm(
        `Remover ${u.nome} (${u.email})? O acesso volta para o padrão EQP no próximo login. A conta no Firebase Authentication permanece — desabilite por lá se quiser bloquear o login.`
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Administração</div>
          <h2 className="mt-1">Usuários</h2>
        </div>
      </header>

      <div className="flex gap-2">
        <AbaBtn ativa={aba === "usuarios"} onClick={() => setAba("usuarios")}>
          Usuários
        </AbaBtn>
        <AbaBtn ativa={aba === "convites"} onClick={() => setAba("convites")}>
          Convites
        </AbaBtn>
      </div>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      {aba === "usuarios" && (
        <>
          {erro && (
            <div className="card border-vermelho/40">
              <div className="card-corpo text-vermelho-escuro">{erro}</div>
            </div>
          )}

          <div className="card">
            <div className="card-corpo text-sm text-ardesia">
              Cada usuário precisa primeiro existir no <strong>Firebase
              Authentication</strong>. Quando ele faz o primeiro login, o app
              cria automaticamente um doc com perfil <strong>EQP</strong>. Use
              esta tela para promover/rebaixar perfil, vincular a uma Pessoa
              do cadastro ou criar manualmente colando o UID do Console.
            </div>
          </div>

          {!criando && !editandoUid && (
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => setCriando(true)}
            >
              Novo usuário
            </button>
          )}

          {criando && (
            <div className="card">
              <div className="card-corpo">
                <h3 className="mb-4">Novo usuário</h3>
                <UsuarioForm
                  pessoas={pessoas}
                  barracasAtivas={barracas}
                  onSubmit={handleCriar}
                  onCancelar={() => setCriando(false)}
                  textoBotao="Cadastrar usuário"
                />
              </div>
            </div>
          )}

          {usuarioEditando && (
            <div className="card">
              <div className="card-corpo">
                <h3 className="mb-4">Editando {usuarioEditando.nome}</h3>
                <UsuarioForm
                  inicial={usuarioEditando}
                  pessoas={pessoas}
                  barracasAtivas={barracas}
                  onSubmit={handleAtualizar}
                  onCancelar={() => setEditandoUid(null)}
                  textoBotao="Salvar alterações"
                />
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-corpo">
              <input
                className="input"
                placeholder="Buscar por nome, e-mail ou perfil..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="tabela-rolavel"><table className="tabela-larga">
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
                  <th className="px-4 py-3 font-semibold w-44 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && !carregando && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ardesia">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
                {lista.map((u) => (
                  <tr
                    key={u.uid}
                    className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">{u.nome}</div>
                      <div className="text-xs text-ardesia font-mono">
                        {u.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          u.perfil === "ADM"
                            ? "badge-vermelho"
                            : u.perfil === "ORG"
                            ? "badge-ouro"
                            : u.perfil === "CRD"
                            ? "badge-azul"
                            : "badge-cinza"
                        }`}
                      >
                        {ROTULO_PERFIL[u.perfil]}
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
                        <button
                          type="button"
                          className="btn btn-secundario btn-pequeno"
                          onClick={() => setEditandoUid(u.uid)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-texto btn-pequeno text-vermelho-escuro"
                          onClick={() => handleRemover(u)}
                          disabled={u.uid === sessao.uid}
                          title={
                            u.uid === sessao.uid
                              ? "Não pode remover o próprio usuário"
                              : ""
                          }
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {aba === "convites" && (
        <>
          {!convidando && (
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => setConvidando(true)}
            >
              Convidar por e-mail
            </button>
          )}

          {convidando && (
            <div className="card">
              <div className="card-corpo">
                <h3 className="mb-4">Convidar por e-mail</h3>
                <p className="text-sm text-ardesia mb-4">
                  O sistema gera um link que envia o convite. Compartilhe com a
                  pessoa convidada. Válido por 7 dias.
                </p>
                <ConviteForm
                  barracasAtivas={barracas}
                  onSubmit={handleConvidar}
                  onCancelar={() => setConvidando(false)}
                />
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-corpo">
              <input
                className="input"
                placeholder="Filtrar por e-mail, perfil ou status..."
                value={filtroConvite}
                onChange={(e) => setFiltroConvite(e.target.value)}
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="tabela-rolavel"><table className="tabela-larga">
              <thead className="bg-pietra-clara/60 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">E-mail</th>
                  <th className="px-4 py-3 font-semibold w-24">Perfil</th>
                  <th className="px-4 py-3 font-semibold w-28">Status</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell w-36">
                    Criado em
                  </th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell w-36">
                    Expira em
                  </th>
                  <th className="px-4 py-3 font-semibold w-48">Link</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const t = filtroConvite.trim().toLowerCase();
                  const filtr = !t
                    ? convites
                    : convites.filter(
                        (c) =>
                          c.email.toLowerCase().includes(t) ||
                          c.perfil.toLowerCase() === t ||
                          c.status.toLowerCase() === t
                      );
                  return filtr.length === 0 && !convitesCarregando ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ardesia">
                        Nenhum convite encontrado.
                      </td>
                    </tr>
                  ) : (
                    filtr.map((c) => (
                      <tr
                        key={c.token}
                        className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                      >
                        <td className="px-4 py-3 font-mono text-sm">{c.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`badge ${
                              c.perfil === "ADM"
                                ? "badge-vermelho"
                                : c.perfil === "ORG"
                                ? "badge-ouro"
                                : c.perfil === "CRD"
                                ? "badge-azul"
                                : "badge-cinza"
                            }`}
                          >
                            {ROTULO_PERFIL[c.perfil]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`badge ${
                              c.status === "pendente"
                                ? "badge-azul"
                                : c.status === "aceito"
                                ? "badge-verde"
                                : "badge-vermelho"
                            }`}
                          >
                            {c.status === "pendente"
                              ? "Pendente"
                              : c.status === "aceito"
                              ? "Aceito"
                              : "Expirado"}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-ardesia font-mono text-xs">
                          {formatarData(c.criadoEm)}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-ardesia font-mono text-xs">
                          {formatarData(c.expiraEm)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno font-mono text-xs"
                            onClick={async () => {
                              const url = `${window.location.origin}/convite/${c.token}`;
                              try {
                                await navigator.clipboard.writeText(url);
                              } catch {
                                prompt("Copie o link:", url);
                              }
                            }}
                          >
                            Copiar link
                          </button>
                        </td>
                      </tr>
                    ))
                  );
                })()}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}
