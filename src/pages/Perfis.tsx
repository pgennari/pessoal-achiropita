import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, podeGerirPerfis } from "../lib/sessao";
import { usePerfis } from "../lib/hooks";
import { Icone } from "../components/Icone";
import {
  CATALOGO_PERMISSOES,
  DadosPerfilForm,
  atualizarPerfil,
  criarPerfil,
  removerPerfil,
  rotuloPermissao,
} from "../lib/perfis";
import { PerfilInfo } from "../lib/tipos";

const REGEX_SIGLA = /^[A-Z0-9]{2,6}$/;

function classeBadgeSigla(sigla: string): string {
  if (sigla === "ADM") return "badge badge-vermelho";
  if (sigla === "ORG") return "badge badge-ouro";
  if (sigla === "CRD") return "badge badge-azul";
  if (sigla === "EQP") return "badge badge-verde";
  return "badge badge-cinza";
}

interface FormularioPerfilProps {
  inicial: PerfilInfo | null;
  onSalvar: (dados: DadosPerfilForm) => Promise<void>;
  onCancelar: () => void;
}

function FormularioPerfil({ inicial, onSalvar, onCancelar }: FormularioPerfilProps) {
  const [sigla, setSigla] = useState(inicial?.sigla ?? "");
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [permissoes, setPermissoes] = useState<string[]>(inicial?.permissoes ?? []);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const bloqueado = inicial?.fixo === true;
  const siglaInvalida = sigla.trim().toUpperCase() !== "" && !REGEX_SIGLA.test(sigla.trim().toUpperCase());

  function alternarPermissao(codigo: string) {
    setPermissoes((atual) =>
      atual.includes(codigo)
        ? atual.filter((c) => c !== codigo)
        : [...atual, codigo]
    );
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (bloqueado) return;
    if (!REGEX_SIGLA.test(sigla.trim().toUpperCase())) {
      setErro("Sigla inválida. Use 2 a 6 letras/dígitos (ex.: ADM, CRD).");
      return;
    }
    if (!nome.trim()) {
      setErro("O nome do perfil é obrigatório.");
      return;
    }
    setEnviando(true);
    try {
      await onSalvar({ sigla, nome, permissoes });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o perfil.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card">
      <div className="card-corpo">
        <h3 className="mb-4">
          {bloqueado
            ? "Perfil fixo"
            : inicial
              ? `Editando ${inicial.sigla} — ${inicial.nome}`
              : "Novo perfil"}
        </h3>
        {bloqueado && (
          <p className="text-sm text-ardesia mb-4">
            O perfil ADM é fixo: não pode ser alterado nem excluído, pois
            garante acesso total ao sistema.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {erro && (
            <div className="card border-vermelho/40">
              <div className="card-corpo py-4 text-vermelho-escuro">{erro}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-grupo">
              <label className="input-label" htmlFor="perfil-sigla">
                Sigla
              </label>
              <input
                id="perfil-sigla"
                className={`input ${siglaInvalida ? "erro" : ""}`}
                value={sigla}
                onChange={(e) => setSigla(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ex.: ADM"
                disabled={!!inicial || bloqueado}
                required
              />
              {inicial && (
                <p className="input-ajuda font-mono text-xs">
                  A sigla é a chave do perfil e não pode ser alterada.
                </p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="perfil-nome">
                Nome do perfil
              </label>
              <input
                id="perfil-nome"
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="ex.: Administrador"
                disabled={bloqueado}
                required
              />
            </div>
          </div>

          <fieldset disabled={bloqueado}>
            <legend className="input-label mb-2">
              Funções que o perfil tem acesso
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {CATALOGO_PERMISSOES.map((p) => (
                <label
                  key={p.codigo}
                  className="flex items-start gap-3 text-sm rounded-sm px-2 py-2 hover:bg-pietra-clara/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={permissoes.includes(p.codigo)}
                    onChange={() => alternarPermissao(p.codigo)}
                  />
                  <span>
                    <span className="font-semibold">{p.rotulo}</span>
                    <span className="block text-xs text-ardesia">
                      {p.descricao}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
            <button
              type="submit"
              className="btn btn-primario"
              disabled={enviando || bloqueado}
              aria-label="Salvar"
              title="Salvar"
            >
              <Icone nome="check" />
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={onCancelar}
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
  );
}

export function Perfis() {
  const { sessao } = useSessao();
  const { itens: perfis, carregando } = usePerfis();
  const [editando, setEditando] = useState<PerfilInfo | null>(null);
  const [criando, setCriando] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const porSigla = useMemo(() => {
    const m = new Map<string, PerfilInfo>();
    for (const p of perfis) m.set(p.sigla, p);
    return m;
  }, [perfis]);

  const perfilEditando = editando ? porSigla.get(editando.sigla) ?? editando : null;

  if (!sessao) return null;
  if (!podeGerirPerfis(sessao)) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas Administração gerencia os perfis de acesso.
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

  const s = sessao;

  async function handleSalvar(dados: DadosPerfilForm) {
    setAcaoErro(null);
    if (editando) {
      await atualizarPerfil(s, editando.sigla, dados);
      setEditando(null);
    } else {
      await criarPerfil(s, dados);
      setCriando(false);
    }
  }

  async function handleExcluir(p: PerfilInfo) {
    setAcaoErro(null);
    if (p.fixo) {
      setAcaoErro("Perfil fixo (ADM) não pode ser excluído.");
      return;
    }
    if (!confirm(`Excluir o perfil ${p.sigla} — ${p.nome}?`)) return;
    try {
      await removerPerfil(s, p.sigla);
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao excluir o perfil.");
    }
  }

  const podeAbrirForm = !criando && !editando;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Administração</div>
          <h2 className="mt-1">Perfis de acesso</h2>
          <p className="text-ardesia text-sm">
            {carregando
              ? "Carregando..."
              : `${perfis.length} perfil(ais) · ${CATALOGO_PERMISSOES.length} permissões no catálogo`}
          </p>
        </div>
        {podeAbrirForm && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => {
              setEditando(null);
              setCriando(true);
            }}
            aria-label="Novo perfil"
            title="Novo perfil"
          >
            <Icone nome="mais" />
          </button>
        )}
      </header>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia">
          Cada perfil define quais funções um usuário pode acessar. O perfil{" "}
          <strong>ADM</strong> é fixo — não pode ser alterado nem excluído. Os
          perfis em uso por usuários ou convites não podem ser excluídos;
          reatribua os usuários antes.
        </div>
      </div>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      {(criando || perfilEditando) && (
        <FormularioPerfil
          inicial={criando ? null : perfilEditando}
          onSalvar={handleSalvar}
          onCancelar={() => {
            setCriando(false);
            setEditando(null);
          }}
        />
      )}

      <div className="card overflow-hidden">
        <div className="tabela-rolavel">
          <table className="tabela-larga">
            <thead className="bg-pietra-clara/60 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold w-28">Sigla</th>
                <th className="px-4 py-3 font-semibold w-56">Perfil</th>
                <th className="px-4 py-3 font-semibold">Funções de acesso</th>
                <th className="px-4 py-3 font-semibold w-40 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ardesia">
                    Carregando...
                  </td>
                </tr>
              )}
              {!carregando && perfis.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ardesia">
                    Nenhum perfil cadastrado.
                  </td>
                </tr>
              )}
              {perfis.map((p) => (
                <tr
                  key={p.sigla}
                  className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                >
                  <td className="px-4 py-3">
                    <span className={classeBadgeSigla(p.sigla)}>{p.sigla}</span>
                    {p.fixo && (
                      <span className="badge badge-cinza ml-2">fixo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">{p.nome}</td>
                  <td className="px-4 py-3">
                    {p.permissoes.length === 0 ? (
                      <span className="text-ardesia text-sm">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.permissoes.map((codigo) => (
                          <span key={codigo} className="badge badge-cinza">
                            {rotuloPermissao(codigo)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {!p.fixo && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secundario btn-pequeno"
                            onClick={() => {
                              setCriando(false);
                              setEditando(p);
                            }}
                            aria-label="Editar"
                            title="Editar"
                          >
                            <Icone nome="lapis" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={() => handleExcluir(p)}
                            aria-label="Excluir"
                            title="Excluir"
                          >
                            <Icone nome="lixeira" />
                          </button>
                        </>
                      )}
                      {p.fixo && (
                        <span className="text-xs text-ardesia italic pr-1">
                          imutável
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
