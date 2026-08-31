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
  totalCoordenadoresAtuais: number;
  vagasCoordenador: number;
  onAdicionar: (membro: MembroEquipeAnterior, funcao: Funcao) => Promise<void>;
}

export function PainelEquipeAnterior({
  aberto,
  onFechar,
  edicaoId,
  equipeId,
  equipeNome,
  podeAlocar,
  totalCoordenadoresAtuais,
  vagasCoordenador,
  onAdicionar,
}: PainelEquipeAnteriorProps) {
  const { dados, carregando, erro } = useEquipeAnterior(edicaoId, equipeId);
  const [enviandoPessoa, setEnviandoPessoa] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const vagaCoordenadorCheia =
    podeAlocar &&
    vagasCoordenador > 0 &&
    totalCoordenadoresAtuais >= vagasCoordenador;

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
              {vagaCoordenadorCheia && (
                <div className="px-5 py-2 text-xs text-ardesia border-b border-pietra-clara">
                  Vaga de coordenador indisponivel nesta equipe.
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-carbone truncate">
                            {m.pessoaNome}
                          </div>
                          <div className="font-mono text-xs text-ardesia">
                            #{m.cracha ?? "—"} · {m.funcaoAnterior}
                          </div>
                        </div>
                        {m.jaNaEquipe ? (
                          <span className="badge badge-verde">ja na equipe</span>
                        ) : m.emOutraEquipe ? (
                          <span className="badge badge-cinza">
                            em outra equipe
                          </span>
                        ) : null}
                      </div>
                      {podeAlocar && !semAcao && (
                        <div className="mt-2 flex flex-wrap gap-2">
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
                            disabled={
                              enviandoPessoa === m.pessoaId ||
                              vagaCoordenadorCheia
                            }
                            onClick={() => adicionar(m, "Coordenador")}
                            aria-label={`Adicionar ${m.pessoaNome} como Coordenador`}
                            title={
                              vagaCoordenadorCheia
                                ? "Vaga de coordenador indisponivel"
                                : "Adicionar como Coordenador"
                            }
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
    </div>
  );
}