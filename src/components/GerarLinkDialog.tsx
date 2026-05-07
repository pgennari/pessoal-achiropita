import { useEffect, useMemo, useState } from "react";
import { useSessao } from "../lib/sessao";
import {
  LinkValidacao,
  Participacao,
  Pessoa,
  TurmaFormacao,
} from "../lib/tipos";
import {
  ErroLink,
  gerarLinkDeTurma,
  revogarLink,
  urlPublica,
} from "../lib/links";
import { useLinksDaTurma } from "../lib/hooks";
import { formatarData } from "../lib/utilsDominio";

type Escopo = "alocadosNaEdicao" | "alocadosNaBarracaDaTurma";

interface Props {
  aberto: boolean;
  turma: TurmaFormacao | null;
  pessoas: Pessoa[];
  participacoes: Participacao[];
  onFechar: () => void;
}

function inicialDateTime(turma: TurmaFormacao | null): string {
  // Default: data + horarioInicio da turma (US-06-05 ajustada).
  if (!turma || !turma.data || !turma.horarioInicio) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(20, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }
  return `${turma.data}T${turma.horarioInicio}`;
}

export function GerarLinkDialog({
  aberto,
  turma,
  pessoas,
  participacoes,
  onFechar,
}: Props) {
  const { sessao } = useSessao();
  const [expiraEmLocal, setExpiraEmLocal] = useState<string>(
    inicialDateTime(turma)
  );
  const [escopo, setEscopo] = useState<Escopo>("alocadosNaEdicao");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiouToken, setCopiouToken] = useState<string | null>(null);

  const { itens: links } = useLinksDaTurma(turma?.id);

  useEffect(() => {
    if (aberto) {
      setExpiraEmLocal(inicialDateTime(turma));
      setErro(null);
      setCopiouToken(null);
      setEscopo(
        turma?.barracaIdVinculo ? "alocadosNaBarracaDaTurma" : "alocadosNaEdicao"
      );
    }
  }, [aberto, turma?.id]);

  const pessoasNoEscopo = useMemo<Pessoa[]>(() => {
    if (!turma) return [];
    const ativosPorId = new Map(
      pessoas.filter((p) => p.ativo).map((p) => [p.id, p])
    );
    if (escopo === "alocadosNaBarracaDaTurma" && turma.barracaIdVinculo) {
      const idsBarraca = new Set(
        participacoes
          .filter((p) => p.barracaId === turma.barracaIdVinculo)
          .map((p) => p.pessoaId)
      );
      return pessoas.filter((p) => ativosPorId.has(p.id) && idsBarraca.has(p.id));
    }
    const idsAlocados = new Set(participacoes.map((p) => p.pessoaId));
    return pessoas.filter((p) => ativosPorId.has(p.id) && idsAlocados.has(p.id));
  }, [escopo, pessoas, participacoes, turma]);

  if (!aberto || !turma || !sessao) return null;

  async function handleGerar() {
    if (!sessao || !turma) return;
    setErro(null);
    setEnviando(true);
    try {
      const expiraEm = new Date(expiraEmLocal);
      await gerarLinkDeTurma(sessao, {
        turma,
        pessoasAtivasComCracha: pessoasNoEscopo,
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
    if (!sessao) return;
    if (!confirm("Revogar este link? Quem clicar verá 'prazo expirado'.")) return;
    setErro(null);
    try {
      await revogarLink(sessao, link);
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] px-4 bg-carbone/40"
      onClick={onFechar}
    >
      <div
        className="card w-full max-w-2xl shadow-media"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-corpo space-y-5">
          <div>
            <div className="eyebrow">Validação pública · turma</div>
            <h3>
              {formatarData(turma.data)} · {turma.horarioInicio}
              {turma.horarioFim ? `–${turma.horarioFim}` : ""}
            </h3>
            <p className="text-ardesia text-sm">{turma.local}</p>
          </div>

          {erro && (
            <div className="border border-vermelho/40 rounded-sm p-3 text-vermelho-escuro text-sm">
              {erro}
            </div>
          )}

          <div className="space-y-3">
            <h4 className="m-0">Gerar novo link</h4>
            <p className="text-ardesia text-sm">
              O link cobre as pessoas escolhidas; cada uma se identifica com
              número de crachá e ano de nascimento (segundo fator). Por padrão
              expira no início desta formação.
            </p>

            <div className="input-grupo m-0">
              <label className="input-label">Quem o link cobre</label>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={escopo === "alocadosNaEdicao"}
                    onChange={() => setEscopo("alocadosNaEdicao")}
                  />
                  <span>
                    Todos os alocados na edição corrente
                    <span className="text-ardesia">
                      {" — "}
                      {escopo === "alocadosNaEdicao"
                        ? `${pessoasNoEscopo.length} pessoa(s)`
                        : ""}
                    </span>
                  </span>
                </label>
                {turma.barracaIdVinculo && (
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={escopo === "alocadosNaBarracaDaTurma"}
                      onChange={() => setEscopo("alocadosNaBarracaDaTurma")}
                    />
                    <span>
                      Apenas alocados na barraca vinculada
                      <span className="text-ardesia">
                        {" — "}
                        {escopo === "alocadosNaBarracaDaTurma"
                          ? `${pessoasNoEscopo.length} pessoa(s)`
                          : ""}
                      </span>
                    </span>
                  </label>
                )}
              </div>
            </div>

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
                <p className="input-ajuda">
                  Default: início da formação. Ajuste se quiser permitir
                  validação após o término.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primario"
                onClick={handleGerar}
                disabled={enviando || pessoasNoEscopo.length === 0}
              >
                {enviando ? "Gerando..." : "Gerar link"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="m-0">Links desta turma</h4>
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
                  const total = Object.keys(link.pessoasMap).length;
                  return (
                    <li key={link.id} className="px-3 py-3 space-y-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className={r.classe}>{r.texto}</span>
                        <span className="text-ardesia text-xs">
                          expira {formatarData(link.expiraEm)} ·{" "}
                          {link.contadorUsos}/{total} usaram · criado por{" "}
                          {link.criadoPorNome}
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
