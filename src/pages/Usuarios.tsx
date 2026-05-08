import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/sessao";
import {
  useBarracas,
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
import { UsuarioForm } from "../components/UsuarioForm";
import { Usuario } from "../lib/tipos";
import { formatarData } from "../lib/utilsDominio";

const ROTULO_PERFIL: Record<string, string> = {
  ADM: "ADM",
  ORG: "ORG",
  CRD: "CRD",
  EQP: "EQP",
  OPC: "OPC",
  REC: "REC",
};

export function Usuarios() {
  const { sessao } = useSessao();
  const { itens: usuarios, carregando, erro } = useUsuarios();
  const { itens: pessoas } = usePessoas();
  const { edicao } = useEdicaoAtiva();
  const { itens: barracas } = useBarracas(edicao?.id);
  const [editandoUid, setEditandoUid] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [filtro, setFiltro] = useState("");
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
          <p className="text-ardesia text-sm">
            {carregando ? "Carregando..." : `${lista.length} usuário(s)`}
          </p>
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
      </header>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia">
          Cada usuário precisa primeiro existir no <strong>Firebase
          Authentication</strong>. Quando ele faz o primeiro login, o app cria
          automaticamente um doc com perfil <strong>EQP</strong>. Use esta
          tela para promover/rebaixar perfil, vincular a uma Pessoa do
          cadastro ou criar manualmente colando o UID do Console.
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
    </div>
  );
}
