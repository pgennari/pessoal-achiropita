// ============================================================================
// CONTROLE DE CATALOGO DE PERMISSOES
// Restrita: podeGerirPerfis (perfil ADM ou permissao "perfis.gerenciar").
// ============================================================================
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSessao, podeGerirPerfis } from "../lib/sessao";
import { api } from "../lib/api";
import {
  DadosPermissaoForm,
  atualizarPermissao,
  criarPermissao,
} from "../lib/perfis";
import { Permissao } from "../lib/tipos";
import { Icone } from "../components/Icone";

const CODIGO_GERENCIA = "perfis.gerenciar";
const REGEX_CODIGO = /^[a-z0-9.]{1,40}$/;

function BadgeStatus({ ativo }: { ativo: boolean }) {
  return ativo
    ? <span className="badge badge-verde">Ativa</span>
    : <span className="badge badge-cinza">Inativa</span>;
}

interface FormularioPermissaoProps {
  inicial: Permissao | null;
  onSalvar: (dados: DadosPermissaoForm) => Promise<void>;
  onCancelar: () => void;
}

function FormularioPermissao({ inicial, onSalvar, onCancelar }: FormularioPermissaoProps) {
  const [codigo, setCodigo] = useState(inicial?.codigo ?? "");
  const [rotulo, setRotulo] = useState(inicial?.rotulo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const codigoInvalido = !inicial && codigo.trim() !== "" && !REGEX_CODIGO.test(codigo.trim().toLowerCase());

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!inicial && !REGEX_CODIGO.test(codigo.trim().toLowerCase())) {
      setErro("Código inválido. Use letras minúsculas, números e pontos (até 40 caracteres).");
      return;
    }
    if (!rotulo.trim()) {
      setErro("O rótulo da permissão é obrigatório.");
      return;
    }
    setEnviando(true);
    try {
      await onSalvar({ codigo, rotulo, descricao });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar a permissão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card">
      <div className="card-corpo">
        <h3 className="mb-4">
          {inicial ? `Editando ${inicial.rotulo}` : "Nova permissão"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          {erro && (
            <div className="card border-vermelho/40">
              <div className="card-corpo py-4 text-vermelho-escuro">{erro}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-grupo">
              <label className="input-label" htmlFor="permissao-codigo">
                Código
              </label>
              <input
                id="permissao-codigo"
                className={`input font-mono ${codigoInvalido ? "erro" : ""}`}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toLowerCase())}
                maxLength={40}
                placeholder="ex.: relatorios.gerar"
                disabled={!!inicial}
                required
              />
              {inicial ? (
                <p className="input-ajuda font-mono text-xs">
                  O código é a chave da permissão e não pode ser alterado.
                </p>
              ) : (
                <p className="input-ajuda font-mono text-xs">
                  Letras minúsculas, números e pontos (ex.: relatorios.gerar).
                </p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="permissao-rotulo">
                Rótulo
              </label>
              <input
                id="permissao-rotulo"
                className="input"
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                maxLength={80}
                placeholder="ex.: Gerar relatórios"
                required
              />
            </div>
          </div>

          <div className="input-grupo">
            <label className="input-label" htmlFor="permissao-descricao">
              Descrição
            </label>
            <textarea
              id="permissao-descricao"
              className="input"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={280}
              placeholder="O que esta permissão concede ao perfil."
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-pietra-clara">
            <button
              type="submit"
              className="btn btn-primario"
              disabled={enviando}
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

export function Permissoes() {
  const { sessao } = useSessao();
  const { data: itens, isLoading } = useQuery({
    queryKey: ["permissoes", "todos"],
    queryFn: () => api.get<Permissao[]>("/api/permissoes?todos=true"),
  });
  const [editando, setEditando] = useState<Permissao | null>(null);
  const [criando, setCriando] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  const catalogo = itens ?? [];

  if (!sessao) return null;
  if (!podeGerirPerfis(sessao)) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas a Administração gerencia as permissões do catálogo.
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

  async function handleSalvar(dados: DadosPermissaoForm) {
    setAcaoErro(null);
    if (editando) {
      await atualizarPermissao(s, editando.codigo, {
        rotulo: dados.rotulo,
        descricao: dados.descricao,
      });
      setEditando(null);
    } else {
      await criarPermissao(s, dados);
      setCriando(false);
    }
  }

  async function handleAlternarAtivo(p: Permissao) {
    setAcaoErro(null);
    if (!p.ativo && !confirm(`Reativar a permissão "${p.rotulo}"?`)) return;
    if (p.ativo && !confirm(`Desativar a permissão "${p.rotulo}"? Ela deixa de conceder acesso a todos os perfis.`)) return;
    try {
      await atualizarPermissao(s, p.codigo, { ativo: !p.ativo });
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao atualizar a permissão.");
    }
  }

  const podeAbrirForm = !criando && !editando;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Administração</div>
          <h2 className="mt-1">Permissões</h2>
          <p className="text-ardesia text-sm">
            {isLoading
              ? "Carregando..."
              : `${catalogo.length} permissão(ões) no catálogo`}
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
            aria-label="Nova permissão"
            title="Nova permissão"
          >
            <Icone nome="mais" />
          </button>
        )}
      </header>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia">
          O catálogo é a fonte única de permissões do sistema. Uma permissão{" "}
          <strong>desativada</strong> deixa de conceder acesso a todos os perfis
          e some da lista de associação. A permissão{" "}
          <strong>{CODIGO_GERENCIA}</strong> nunca pode ser desativada.
        </div>
      </div>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      {(criando || editando) && (
        <FormularioPermissao
          inicial={criando ? null : editando}
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
                <th className="px-4 py-3 font-semibold w-52">Código</th>
                <th className="px-4 py-3 font-semibold w-56">Permissão</th>
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-4 py-3 font-semibold w-24">Status</th>
                <th className="px-4 py-3 font-semibold w-40 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ardesia">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && catalogo.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ardesia">
                    Nenhuma permissão cadastrada.
                  </td>
                </tr>
              )}
              {catalogo.map((p) => (
                <tr
                  key={p.codigo}
                  className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                >
                  <td className="px-4 py-3 font-mono text-sm">{p.codigo}</td>
                  <td className="px-4 py-3 font-semibold">{p.rotulo}</td>
                  <td className="px-4 py-3 text-ardesia text-sm">
                    {p.descricao || "—"}
                  </td>
                  <td className="px-4 py-3"><BadgeStatus ativo={p.ativo} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
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
                      {p.codigo !== CODIGO_GERENCIA && (
                        <button
                          type="button"
                          className={`btn btn-texto btn-pequeno ${p.ativo ? "text-vermelho-escuro" : ""}`}
                          onClick={() => handleAlternarAtivo(p)}
                          aria-label={p.ativo ? "Desativar" : "Reativar"}
                          title={p.ativo ? "Desativar" : "Reativar"}
                        >
                          <Icone nome={p.ativo ? "proibido" : "recarregar"} />
                        </button>
                      )}
                      {p.codigo === CODIGO_GERENCIA && (
                        <span className="text-xs text-ardesia italic pr-1">
                          protegida
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
