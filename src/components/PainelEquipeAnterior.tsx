// Painel lateral "Equipe da edicao anterior" (029).
// Abre no detalhe da equipe quando a edicao esta em planejamento; lista as
// pessoas que participaram da equipe correspondente na edicao N-1 e permite
// adiciona-las como Equipista ou Coordenador (reusa POST /api/participacoes).
import { useEffect, useState } from "react";
import { useEquipeAnterior } from "../lib/hooks";
import { MembroEquipeAnterior } from "../lib/participacoes";
import { Funcao } from "../lib/tipos";
import { Icone } from "./Icone";

export interface PainelEquipeAnteriorProps {
  aberto: boolean;
  onFechar: () => void;
  edicaoId: string;
  equipeId: string;
  equipeNome: string;
  podeAlocar: boolean;
  onAdicionar: (membro: MembroEquipeAnterior, funcao: Funcao) => Promise<void>;
}

export function PainelEquipeAnterior({
  aberto,
  onFechar,
  edicaoId,
  equipeId,
  equipeNome,
  podeAlocar,
  onAdicionar,
}: PainelEquipeAnteriorProps) {
  const { dados, carregando, erro } = useEquipeAnterior(edicaoId, equipeId);
  const [enviandoPessoa, setEnviandoPessoa] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<{ url: string; nome: string } | null>(null);

  useEffect(() => {
    if (!aberto) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  async function adicionar(membro: MembroEquipeAnterior, funcao: Funcao) {
    setErroAcao(null);
    setEnviandoPessoa(membro.pessoaId);
    try {
      await onAdicionar(membro, funcao);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao adicionar.");
    } finally {
      setEnviandoPessoa(null);
    }
  }

  function inicialDe(nome: string): string {
    return nome.trim().charAt(0).toUpperCase();
  }

  const semEdicaoAnterior = dados !== null && dados.edicaoAnterior === null;
  const listaVazia =
    dados !== null &&
    dados.edicaoAnterior !== null &&
    dados.pessoas.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-carbone/40"
      role="dialog"
      aria-modal="true"
      aria-label="Equipe da edicao anterior"
      onClick={onFechar}
    >
      <aside
        className="fixed inset-y-0 right-0 flex w-full max-w-md flex-col bg-bianco shadow-media"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-pietra-clara px-5 py-4">
          <div className="mr-auto min-w-0">
            <div className="eyebrow">Equipe da edicao anterior</div>
            <h3 className="mt-1 truncate">{equipeNome}</h3>
          </div>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={onFechar}
            aria-label="Fechar"
            title="Fechar"
          >
            <Icone nome="fechar" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {carregando && (
            <p className="px-5 py-6 text-ardesia">Carregando...</p>
          )}
          {!carregando && erro && (
            <p className="px-5 py-6 text-vermelho-escuro">{erro}</p>
          )}
          {!carregando && !erro && semEdicaoAnterior && (
            <p className="px-5 py-6 text-center text-ardesia">
              Nao ha dados de edicao anterior.
            </p>
          )}
          {!carregando && !erro && listaVazia && (
            <p className="px-5 py-6 text-center text-ardesia">
              Nenhuma pessoa encontrada para esta equipe na edicao anterior.
            </p>
          )}
          {!carregando && !erro && dados && !semEdicaoAnterior && !listaVazia && (
            <div>
              {dados.edicaoAnterior && (
                <div className="px-5 py-2 font-mono text-xs text-ardesia border-b border-pietra-clara">
                  {dados.edicaoAnterior.numero}ª edicao · {dados.pessoas.length}{" "}
                  {dados.pessoas.length === 1 ? "pessoa" : "pessoas"}
                </div>
              )}
              {erroAcao && (
                <div className="px-5 py-2 text-xs text-vermelho-escuro border-b border-pietra-clara">
                  {erroAcao}
                </div>
              )}
              <ul className="divide-y divide-pietra-clara">
                {dados.pessoas.map((m) => {
                  const semAcao = m.jaNaEquipe || m.emOutraEquipe;
                  return (
                    <li key={m.pessoaId} className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-md ring-2 ring-bianco overflow-hidden flex items-center justify-center text-bianco font-display text-base cursor-pointer"
                          style={
                            m.fotoUrl
                              ? undefined
                              : { background: "linear-gradient(135deg, #2E9D52, #16753A)" }
                          }
                          onClick={() => m.fotoUrl && setFotoAmpliada({ url: m.fotoUrl, nome: m.pessoaNome })}
                          disabled={!m.fotoUrl}
                          aria-label={`Ver foto completa de ${m.pessoaNome}`}
                          title={m.fotoUrl ? "Ver foto completa" : undefined}
                        >
                          {m.fotoUrl ? (
                            <img
                              src={m.fotoUrl}
                              alt={`Foto de ${m.pessoaNome}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            inicialDe(m.pessoaNome)
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="font-semibold text-carbone truncate">
                            {m.pessoaNome}
                          </div>
                          <div className="font-mono text-xs text-ardesia">
                            #{m.cracha ?? "—"} · {m.funcaoAnterior}
                          </div>
                        </div>
                        {m.jaNaEquipe ? (
                          <span className="badge badge-verde ml-auto">ja na equipe</span>
                        ) : m.emOutraEquipe ? (
                          <span className="badge badge-cinza ml-auto">
                            em outra equipe
                          </span>
                        ) : null}
                      </div>
                      {podeAlocar && !semAcao && (
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-secundario btn-grande"
                            disabled={enviandoPessoa === m.pessoaId}
                            onClick={() => adicionar(m, "Equipista")}
                            aria-label={`Adicionar ${m.pessoaNome} como Equipista`}
                            title="Adicionar como Equipista"
                          >
                            <Icone nome="usuario-equipista" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-primario btn-grande"
                            disabled={enviandoPessoa === m.pessoaId}
                            onClick={() => adicionar(m, "Coordenador")}
                            aria-label={`Adicionar ${m.pessoaNome} como Coordenador`}
                            title="Adicionar como Coordenador"
                          >
                            <Icone nome="usuario-coordenador" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-pietra-clara px-5 py-3 font-mono text-xs text-ardesia">
          <span>edicao anterior: {dados?.edicaoAnterior?.numero ?? "—"}</span>
          <span>esc fechar</span>
        </footer>
      </aside>

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbone/80"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${fotoAmpliada.nome} em tamanho real`}
          onClick={(e) => {
            e.stopPropagation();
            setFotoAmpliada(null);
          }}
        >
          <img
            src={fotoAmpliada.url}
            alt={`Foto de ${fotoAmpliada.nome}`}
            className="max-h-[90vh] max-w-[90vw] object-contain shadow-media"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 btn btn-secundario btn-pequeno"
            onClick={(e) => {
              e.stopPropagation();
              setFotoAmpliada(null);
            }}
            aria-label="Fechar"
            title="Fechar"
          >
            <Icone nome="fechar" />
          </button>
        </div>
      )}
    </div>
  );
}