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
  removerUsuario,
} from "../lib/usuarios";
import {
  DadosConviteForm,
  atualizarConvite,
  chaveConvite,
  criarConvite,
  removerConvite,
  revogarConvite,
} from "../lib/convites";
import { UsuarioForm } from "../components/UsuarioForm";
import { ConviteForm } from "../components/ConviteForm";
import { Convite, Usuario } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

const ROTULO_PERFIL: Record<string, string> = {
  ADM: "ADM",
  ORG: "ORG",
  CRD: "CRD",
  EQP: "EQP",
  OPC: "OPC",
  REC: "REC",
};

function classePerfilBadge(p: string): string {
  if (p === "ADM") return "badge badge-vermelho";
  if (p === "ORG") return "badge badge-ouro";
  if (p === "CRD") return "badge badge-azul";
  return "badge badge-cinza";
}

export function Usuarios() {
  const { sessao } = useSessao();
  const { itens: usuarios, carregando, erro } = useUsuarios();
  const { itens: convites, carregando: carregandoConvites } = useConvites();
  const { itens: pessoas } = usePessoas();
  const { edicao } = useEdicaoAtiva();
  const { itens: barracas } = useBarracas(edicao?.id);
  const [editandoUid, setEditandoUid] = useState<string | null>(null);
  const [editandoConviteKey, setEditandoConviteKey] = useState<string | null>(
    null
  );
  const [criandoConvite, setCriandoConvite] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const indicePessoas = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pessoas) m.set(p.id, `#${p.cracha} ${p.nome}`);
    return m;
  }, [pessoas]);

  const emailsEmUso = useMemo(
    () => new Set(usuarios.map((u) => u.email.toLowerCase())),
    [usuarios]
  );

  const listaUsuarios = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t) ||
        u.perfil.toLowerCase() === t
    );
  }, [usuarios, filtro]);

  const convitesPendentes = useMemo(
    () => convites.filter((c) => c.status === "pendente"),
    [convites]
  );
  const convitesEncerrados = useMemo(
    () => convites.filter((c) => c.status !== "pendente"),
    [convites]
  );

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

  const usuarioEditando =
    usuarios.find((u) => u.uid === editandoUid) ?? null;
  const conviteEditando =
    convites.find((c) => chaveConvite(c.email) === editandoConviteKey) ?? null;

  async function handleCriarConvite(dados: DadosConviteForm) {
    if (!sessao) return;
    if (emailsEmUso.has(chaveConvite(dados.email))) {
      throw new Error(
        "Já existe um usuário cadastrado com esse e-mail; edite o usuário em vez de gerar convite."
      );
    }
    await criarConvite(sessao, dados);
    setCriandoConvite(false);
  }

  async function handleAtualizarConvite(dados: DadosConviteForm) {
    if (!sessao || !conviteEditando) return;
    await atualizarConvite(
      sessao,
      chaveConvite(conviteEditando.email),
      dados
    );
    setEditandoConviteKey(null);
  }

  async function handleAtualizarUsuario(dados: DadosUsuarioForm) {
    if (!sessao || !usuarioEditando) return;
    await atualizarUsuario(sessao, usuarioEditando.uid, dados);
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

  const podeAbrirNovo =
    !criandoConvite && !editandoConviteKey && !editandoUid;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Administração</div>
          <h2 className="mt-1">Usuários</h2>
          <p className="text-ardesia text-sm">
            {carregando
              ? "Carregando..."
              : `${listaUsuarios.length} usuário(s) · ${convitesPendentes.length} convite(s) pendente(s)`}
          </p>
        </div>
        {podeAbrirNovo && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => setCriandoConvite(true)}
          >
            Novo usuário
          </button>
        )}
      </header>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia">
          ADM convida pelo e-mail. O doc{" "}
          <code className="font-mono">/usuarios/{"{uid}"}</code> é criado
          automaticamente no primeiro login da pessoa convidada, já com o
          perfil escolhido. Quem entra sem convite cai no perfil padrão{" "}
          <strong>EQP</strong>; você pode promover depois pela linha do
          usuário.
        </div>
      </div>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}
      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {criandoConvite && (
        <div className="card">
          <div className="card-corpo">
            <h3 className="mb-4">Novo convite</h3>
            <ConviteForm
              pessoas={pessoas}
              barracasAtivas={barracas}
              onSubmit={handleCriarConvite}
              onCancelar={() => setCriandoConvite(false)}
              textoBotao="Gerar convite"
            />
          </div>
        </div>
      )}

      {conviteEditando && (
        <div className="card">
          <div className="card-corpo">
            <h3 className="mb-4">Editando convite — {conviteEditando.email}</h3>
            <ConviteForm
              inicial={conviteEditando}
              pessoas={pessoas}
              barracasAtivas={barracas}
              onSubmit={handleAtualizarConvite}
              onCancelar={() => setEditandoConviteKey(null)}
              textoBotao="Salvar convite"
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
              onSubmit={handleAtualizarUsuario}
              onCancelar={() => setEditandoUid(null)}
              textoBotao="Salvar alterações"
            />
          </div>
        </div>
      )}

      <section>
        <h3 className="mb-3">
          Convites pendentes
          {convitesPendentes.length > 0 && (
            <span className="text-ardesia text-sm font-normal">
              {" · "}
              {convitesPendentes.length}
            </span>
          )}
        </h3>
        {carregandoConvites ? (
          <p className="text-ardesia text-sm">Carregando...</p>
        ) : convitesPendentes.length === 0 ? (
          <p className="text-ardesia text-sm">
            Nenhum convite pendente.
          </p>
        ) : (
          <div className="card overflow-hidden">
            <div className="tabela-rolavel">
              <table className="tabela-larga">
                <thead className="bg-pietra-clara/60 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Convidado</th>
                    <th className="px-4 py-3 font-semibold w-24">Perfil</th>
                    <th className="px-4 py-3 font-semibold hidden lg:table-cell w-36">
                      Criado em
                    </th>
                    <th className="px-4 py-3 font-semibold w-44 text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {convitesPendentes.map((c) => (
                    <tr
                      key={chaveConvite(c.email)}
                      className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold">{c.nome}</div>
                        <div className="text-xs text-ardesia font-mono">
                          {c.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={classePerfilBadge(c.perfil)}>
                          {ROTULO_PERFIL[c.perfil]}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-ardesia font-mono text-xs">
                        {formatarData(c.criadoEm)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            className="btn btn-secundario btn-pequeno"
                            onClick={() =>
                              setEditandoConviteKey(chaveConvite(c.email))
                            }
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={() => handleRevogarConvite(c)}
                          >
                            Revogar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h3 className="m-0">Usuários cadastrados</h3>
          <span className="text-ardesia text-sm">
            {listaUsuarios.length} de {usuarios.length}
          </span>
        </div>

        <div className="card mb-4">
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
                    className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">{u.nome}</div>
                      <div className="text-xs text-ardesia font-mono">
                        {u.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={classePerfilBadge(u.perfil)}>
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
                          onClick={() => handleRemoverUsuario(u)}
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
            </table>
          </div>
        </div>
      </section>

      {convitesEncerrados.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ardesia">
            Histórico de convites ({convitesEncerrados.length})
          </summary>
          <ul className="mt-3 divide-y divide-pietra-clara border border-pietra-clara rounded-sm">
            {convitesEncerrados.map((c) => (
              <li
                key={chaveConvite(c.email)}
                className="px-3 py-2 flex flex-wrap items-center gap-2"
              >
                <span
                  className={
                    c.status === "usado"
                      ? "badge badge-verde"
                      : "badge badge-cinza"
                  }
                >
                  {c.status}
                </span>
                <span className="font-mono text-xs text-ardesia">
                  {c.email}
                </span>
                <span className="text-ardesia">— {c.nome}</span>
                <span className={`${classePerfilBadge(c.perfil)} ml-auto`}>
                  {ROTULO_PERFIL[c.perfil]}
                </span>
                <button
                  type="button"
                  className="btn btn-texto btn-pequeno text-vermelho-escuro"
                  onClick={() => handleRemoverConvite(c)}
                >
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
