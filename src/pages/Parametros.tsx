// ============================================================================
// PARAMETROS DO SISTEMA
// Restrita: permissao "parametros.acessar" (o ADM tem acesso como superuser).
// O valor e texto livre e pode guardar JSON; o formulario traz ferramentas
// de formatar, validar e visualizar JSON.
// ============================================================================
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useSessao, pode } from "../lib/sessao";
import { useParametros } from "../lib/hooks";
import {
  DadosParametroForm,
  atualizarParametro,
  criarParametro,
} from "../lib/parametros";
import { Parametro } from "../lib/tipos";
import { Icone } from "../components/Icone";

const REGEX_CHAVE = /^[a-z0-9._-]{1,64}$/;

interface AnaliseJson {
  ok: boolean;
  dado?: unknown;
  erro?: string;
}

function analisarJson(valor: string): AnaliseJson {
  if (!valor.trim()) return { ok: true };
  try {
    return { ok: true, dado: JSON.parse(valor) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "JSON inválido." };
  }
}

function BadgeStatus({ ativo }: { ativo: boolean }) {
  return ativo
    ? <span className="badge badge-verde">Ativo</span>
    : <span className="badge badge-cinza">Inativo</span>;
}

function IndicadorJson({ analise }: { analise: AnaliseJson }) {
  if (!analise.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-vermelho-escuro">
        <Icone nome="alerta" tamanho={14} />
        JSON inválido
      </span>
    );
  }
  if (analise.dado === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-verde-escuro">
      <Icone nome="check-circular" tamanho={14} />
      JSON válido
    </span>
  );
}

interface FormularioParametroProps {
  inicial: Parametro | null;
  onSalvar: (dados: DadosParametroForm) => Promise<void>;
  onCancelar: () => void;
}

function FormularioParametro({ inicial, onSalvar, onCancelar }: FormularioParametroProps) {
  const [chave, setChave] = useState(inicial?.chave ?? "");
  const [valor, setValor] = useState(inicial?.valor ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; texto: string } | null>(null);

  const analise = analisarJson(valor);
  const chaveInvalida = !inicial && chave.trim() !== "" && !REGEX_CHAVE.test(chave.trim().toLowerCase());

  function handleFormatar() {
    if (!analise.ok) {
      setFeedback({ ok: false, texto: analise.erro ?? "JSON inválido." });
      return;
    }
    if (analise.dado === undefined) {
      setFeedback({ ok: false, texto: "Nada para formatar." });
      return;
    }
    setValor(JSON.stringify(analise.dado, null, 2));
    setFeedback({ ok: true, texto: "Valor formatado como JSON." });
  }

  function handleValidar() {
    setFeedback(
      analise.ok
        ? { ok: true, texto: "JSON válido." }
        : { ok: false, texto: analise.erro ?? "JSON inválido." }
    );
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!inicial && !REGEX_CHAVE.test(chave.trim().toLowerCase())) {
      setErro("Chave inválida. Use letras minúsculas, números, pontos, hífen e sublinhado (até 64 caracteres).");
      return;
    }
    setEnviando(true);
    try {
      await onSalvar({ chave, valor, descricao });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o parâmetro.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card">
      <div className="card-corpo">
        <h3 className="mb-4">
          {inicial ? `Editando ${inicial.chave}` : "Novo parâmetro"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          {erro && (
            <div className="card border-vermelho/40">
              <div className="card-corpo py-4 text-vermelho-escuro">{erro}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-grupo">
              <label className="input-label" htmlFor="parametro-chave">
                Chave
              </label>
              <input
                id="parametro-chave"
                className={`input font-mono ${chaveInvalida ? "erro" : ""}`}
                value={chave}
                onChange={(e) => setChave(e.target.value.toLowerCase())}
                maxLength={64}
                placeholder="ex.: regra.confirmacao_obrigatoria"
                disabled={!!inicial}
                required
              />
              {inicial ? (
                <p className="input-ajuda font-mono text-xs">
                  A chave identifica o parâmetro e não pode ser alterada.
                </p>
              ) : (
                <p className="input-ajuda font-mono text-xs">
                  Letras minúsculas, números, pontos, hífen e sublinhado.
                </p>
              )}
            </div>

            <div className="input-grupo">
              <label className="input-label" htmlFor="parametro-descricao">
                Descrição
              </label>
              <input
                id="parametro-descricao"
                className="input"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={280}
                placeholder="Para que serve este parâmetro."
              />
            </div>
          </div>

          <div className="input-grupo">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="input-label" htmlFor="parametro-valor">
                Valor
              </label>
              <IndicadorJson analise={analise} />
            </div>
            <textarea
              id="parametro-valor"
              className="input font-mono min-h-[160px]"
              rows={6}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              maxLength={10000}
              placeholder='Texto livre. Ex.: {"prazo": 3, "unidade": "dias"}'
            />
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={handleFormatar}
                aria-label="Formatar JSON"
                title="Formatar JSON"
              >
                <Icone nome="varinha" tamanho={16} />
              </button>
              <button
                type="button"
                className="btn btn-secundario btn-pequeno"
                onClick={handleValidar}
                aria-label="Validar JSON"
                title="Validar JSON"
              >
                <Icone nome="check-circular" tamanho={16} />
              </button>
              {feedback && (
                <span className={`text-xs ${feedback.ok ? "text-verde-escuro" : "text-vermelho-escuro"}`}>
                  {feedback.texto}
                </span>
              )}
            </div>
            {analise.ok && analise.dado !== undefined && (
              <pre className="mt-3 rounded-sm bg-pietra-clara/60 p-3 text-xs font-mono whitespace-pre-wrap break-all overflow-auto max-h-72">
                {JSON.stringify(analise.dado, null, 2)}
              </pre>
            )}
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

function ResumoValor({ valor }: { valor: string }) {
  const resumido = valor.length > 60 ? `${valor.slice(0, 60)}…` : valor;
  return <span className="font-mono text-xs text-ardesia">{resumido || "—"}</span>;
}

export function Parametros() {
  const { sessao } = useSessao();
  const { itens, carregando } = useParametros();
  const [editando, setEditando] = useState<Parametro | null>(null);
  const [criando, setCriando] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);

  if (!sessao) return null;
  if (!pode(sessao, "parametros.acessar")) {
    return (
      <div className="card">
        <div className="card-corpo">
          <h3 className="mb-2">Sem permissão</h3>
          <p className="text-ardesia">
            Apenas quem possui a permissão parametros.acessar visualiza os
            parâmetros do sistema.
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

  async function handleSalvar(dados: DadosParametroForm) {
    setAcaoErro(null);
    if (editando) {
      await atualizarParametro(s, editando.chave, {
        valor: dados.valor,
        descricao: dados.descricao,
      });
      setEditando(null);
    } else {
      await criarParametro(s, dados);
      setCriando(false);
    }
  }

  async function handleAlternarAtivo(p: Parametro) {
    setAcaoErro(null);
    if (!p.ativo && !confirm(`Reativar o parâmetro "${p.chave}"?`)) return;
    if (p.ativo && !confirm(`Desativar o parâmetro "${p.chave}"? Ele deixa de valer nas leituras padrão.`)) return;
    try {
      await atualizarParametro(s, p.chave, { ativo: !p.ativo });
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao atualizar o parâmetro.");
    }
  }

  const podeAbrirForm = !criando && !editando;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Administração</div>
          <h2 className="mt-1">Parâmetros</h2>
          <p className="text-ardesia text-sm">
            {carregando
              ? "Carregando..."
              : `${itens.length} parâmetro(s) cadastrado(s)`}
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
            aria-label="Novo parâmetro"
            title="Novo parâmetro"
          >
            <Icone nome="mais" />
          </button>
        )}
      </header>

      <div className="card">
        <div className="card-corpo text-sm text-ardesia">
          Os parâmetros são pares chave/valor usados pelo sistema. O{" "}
          <strong>valor</strong> é texto livre e pode guardar JSON — use as
          ferramentas do formulário para formatar, validar e visualizar. Um
          parâmetro <strong>desativado</strong> deixa de valer nas leituras
          padrão.
        </div>
      </div>

      {acaoErro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{acaoErro}</div>
        </div>
      )}

      {(criando || editando) && (
        <FormularioParametro
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
                <th className="px-4 py-3 font-semibold w-64">Chave</th>
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-4 py-3 font-semibold w-72">Valor</th>
                <th className="px-4 py-3 font-semibold w-24">Status</th>
                <th className="px-4 py-3 font-semibold w-40 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ardesia">
                    Carregando...
                  </td>
                </tr>
              )}
              {!carregando && itens.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ardesia">
                    Nenhum parâmetro cadastrado.
                  </td>
                </tr>
              )}
              {itens.map((p) => (
                <tr
                  key={p.chave}
                  className="border-t border-pietra-clara hover:bg-pietra-clara/40"
                >
                  <td className="px-4 py-3 font-mono text-sm">{p.chave}</td>
                  <td className="px-4 py-3 text-ardesia text-sm">
                    {p.descricao || "—"}
                  </td>
                  <td className="px-4 py-3"><ResumoValor valor={p.valor} /></td>
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
                      <button
                        type="button"
                        className={`btn btn-texto btn-pequeno ${p.ativo ? "text-vermelho-escuro" : ""}`}
                        onClick={() => handleAlternarAtivo(p)}
                        aria-label={p.ativo ? "Desativar" : "Reativar"}
                        title={p.ativo ? "Desativar" : "Reativar"}
                      >
                        <Icone nome={p.ativo ? "proibido" : "recarregar"} />
                      </button>
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
