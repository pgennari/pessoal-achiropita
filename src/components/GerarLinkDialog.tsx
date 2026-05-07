import { useEffect, useState } from "react";
import { useSessao } from "../lib/sessao";
import { LinkValidacao, Pessoa } from "../lib/tipos";
import {
  ErroLink,
  gerarLinkIndividual,
  revogarLink,
  urlPublica,
} from "../lib/links";
import { useLinksDaPessoa } from "../lib/hooks";
import { formatarData } from "../lib/utilsDominio";

interface Props {
  aberto: boolean;
  pessoa: Pessoa | null;
  edicaoId: string | undefined;
  onFechar: () => void;
}

function dataPadrao(): string {
  // Default expiration: 7 dias a partir de hoje, 23:59 local.
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return d.toISOString().slice(0, 16);
}

export function GerarLinkDialog({
  aberto,
  pessoa,
  edicaoId,
  onFechar,
}: Props) {
  const { sessao } = useSessao();
  const [expiraEmLocal, setExpiraEmLocal] = useState<string>(dataPadrao());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiouToken, setCopiouToken] = useState<string | null>(null);

  const { itens: links } = useLinksDaPessoa(pessoa?.id, edicaoId);

  useEffect(() => {
    if (aberto) {
      setExpiraEmLocal(dataPadrao());
      setErro(null);
      setCopiouToken(null);
    }
  }, [aberto, pessoa?.id]);

  if (!aberto || !pessoa || !edicaoId || !sessao) return null;

  async function handleGerar() {
    if (!sessao || !pessoa || !edicaoId) return;
    setErro(null);
    setEnviando(true);
    try {
      const expiraEm = new Date(expiraEmLocal);
      await gerarLinkIndividual(sessao, {
        pessoaId: pessoa.id,
        pessoaNome: pessoa.nome,
        cracha: pessoa.cracha,
        edicaoId,
        expiraEm,
      });
    } catch (e) {
      if (e instanceof ErroLink) setErro(e.message);
      else setErro(e instanceof Error ? e.message : "Falha ao gerar link.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleRevogar(link: LinkValidacao) {
    if (!sessao || !pessoa) return;
    if (!confirm("Revogar este link? Quem clicar verá 'prazo expirado'.")) return;
    setErro(null);
    try {
      await revogarLink(sessao, link, pessoa.nome);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao revogar.");
    }
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(urlPublica(token));
      setCopiouToken(token);
      setTimeout(() => setCopiouToken((c) => (c === token ? null : c)), 2000);
    } catch {
      setErro("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  function rotuloStatus(link: LinkValidacao): {
    classe: string;
    texto: string;
  } {
    if (link.status === "revogado")
      return { classe: "badge badge-cinza", texto: "revogado" };
    const expirado = new Date(link.expiraEm) <= new Date();
    if (expirado) return { classe: "badge badge-cinza", texto: "expirado" };
    return { classe: "badge badge-verde", texto: "ativo" };
  }

  const ativos = links.filter(
    (l) => l.status === "ativo" && new Date(l.expiraEm) > new Date()
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-carbone/40"
      onClick={onFechar}
    >
      <div
        className="card w-full max-w-2xl shadow-media"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-corpo space-y-5">
          <div>
            <div className="eyebrow">Validação pública</div>
            <h3>{pessoa.nome}</h3>
            <p className="text-ardesia text-sm font-mono">#{pessoa.cracha}</p>
          </div>

          {erro && (
            <div className="border border-vermelho/40 rounded-sm p-3 text-vermelho-escuro text-sm">
              {erro}
            </div>
          )}

          <div className="space-y-3">
            <h4 className="m-0">Gerar novo link individual</h4>
            <p className="text-ardesia text-sm">
              Link com token único, amarrado a esta pessoa. Quem abrir confirma
              os dados, registra presença e marca <em>dadosValidados</em>. O
              link continua aceitando confirmações até o prazo escolhido (a
              pessoa pode reabrir se precisar corrigir algo).
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="input-grupo m-0 flex-1 min-w-[220px]">
                <label className="input-label" htmlFor="expira">
                  Expira em
                </label>
                <input
                  id="expira"
                  type="datetime-local"
                  className="input"
                  value={expiraEmLocal}
                  onChange={(e) => setExpiraEmLocal(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-primario"
                onClick={handleGerar}
                disabled={enviando}
              >
                {enviando ? "Gerando..." : "Gerar link"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="m-0">Links desta pessoa nesta edição</h4>
              <span className="text-xs text-ardesia">
                {ativos.length} ativo(s) · {links.length} total
              </span>
            </div>
            {links.length === 0 ? (
              <p className="text-ardesia text-sm">Nenhum link gerado.</p>
            ) : (
              <ul className="divide-y divide-pietra-clara border border-pietra-clara rounded-sm">
                {links.map((link) => {
                  const r = rotuloStatus(link);
                  return (
                    <li key={link.id} className="px-3 py-3 space-y-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className={r.classe}>{r.texto}</span>
                        <span className="text-ardesia text-xs">
                          expira {formatarData(link.expiraEm)} ·{" "}
                          {link.contadorUsos} uso(s) ·{" "}
                          criado por {link.criadoPorNome}
                        </span>
                      </div>
                      <code className="block bg-pietra-clara/40 rounded-sm px-2 py-1 text-xs break-all">
                        {urlPublica(link.id)}
                      </code>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-secundario btn-pequeno"
                          onClick={() => copiar(link.id)}
                        >
                          {copiouToken === link.id ? "Copiado!" : "Copiar"}
                        </button>
                        {link.status === "ativo" && (
                          <button
                            type="button"
                            className="btn btn-texto btn-pequeno text-vermelho-escuro"
                            onClick={() => handleRevogar(link)}
                          >
                            Revogar
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-pietra-clara">
            <button
              type="button"
              className="btn btn-secundario"
              onClick={onFechar}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
