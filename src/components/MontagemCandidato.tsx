import { useState } from "react";
import { Icone } from "./Icone";
import { useSessao, temPermissao } from "../lib/sessao";
import type { CandidatoMontagem, MatchHistoricoResponse } from "../lib/tipos";

function calcularIdade(nascimento: string | null): string | null {
  if (!nascimento) return null;
  const nasc = new Date(nascimento);
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return `${idade} anos`;
}

function corMatch(match: number): string {
  if (match >= 75) return "badge badge-verde";
  if (match >= 50) return "badge badge-azul";
  if (match >= 25) return "badge badge-ouro";
  return "badge badge-cinza";
}

interface MontagemCandidatoProps {
  candidato: CandidatoMontagem;
  jaTemCoordenador: boolean;
  onAdicionar: (pessoaId: string, funcao: "coordenador" | "equipista", pessoaNome: string) => void;
}

export function MontagemCandidato({
  candidato,
  jaTemCoordenador,
  onAdicionar,
}: MontagemCandidatoProps) {
  const { sessao } = useSessao();
  const [expandido, setExpandido] = useState(false);
  const [edicaoIndex, setEdicaoIndex] = useState(0);

  const podeAlocar = temPermissao(sessao, "edicao.equipeAlocar");

  async function aoExpandir() {
    if (expandido) {
      setExpandido(false);
      return;
    }
    setExpandido(!expandido);
  }

  const idade = calcularIdade(candidato.pessoaNascimento);
  const edicoes: MatchHistoricoResponse["edicoes"] = [];
  const edicaoAtual = edicoes[edicaoIndex] ?? null;

  return (
    <div className="card">
      <div
        className="card-corpo cursor-pointer"
        onClick={aoExpandir}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && aoExpandir()}
      >
        <div className="flex items-center gap-3">
          {candidato.pessoaFotoUrl ? (
            <img
              src={candidato.pessoaFotoUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-cinza-100 flex items-center justify-center">
              <Icone nome="usuario" tamanho={20} className="text-ardesia" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{candidato.pessoaNome}</p>
            {idade && (
              <p className="text-sm text-ardesia">{idade}</p>
            )}
          </div>
          <span className={corMatch(candidato.match)}>
            {candidato.match}pts
          </span>
          <Icone
            nome={expandido ? "seta-baixo" : "seta-direita"}
            tamanho={16}
            className="text-ardesia"
          />
        </div>
      </div>

      {expandido && (
        <div className="border-t mt-3 pt-3">
          {/* Detalhes do match */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-ardesia">Historico</p>
              <p className="font-semibold">{candidato.matchDetalhe.historico}/50</p>
            </div>
            <div>
              <p className="text-xs text-ardesia">Criterios</p>
              <p className="font-semibold">{candidato.matchDetalhe.criterios}/30</p>
            </div>
            <div>
              <p className="text-xs text-ardesia">Convidar novamente</p>
              <p className="font-semibold">{candidato.matchDetalhe.convidarNovamente}/10</p>
            </div>
            <div>
              <p className="text-xs text-ardesia">Presencas</p>
              <p className="font-semibold">{candidato.matchDetalhe.presencas}/10</p>
            </div>
          </div>

          {/* Historico de edicoes */}
          {edicoes.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  disabled={edicaoIndex === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEdicaoIndex(Math.max(0, edicaoIndex - 1));
                  }}
                >
                  <Icone nome="seta-esquerda" tamanho={14} />
                </button>
                <span className="text-sm font-semibold">
                  Edicao {edicaoAtual?.edicaoNumero ?? "-"}
                </span>
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  disabled={edicaoIndex >= edicoes.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEdicaoIndex(Math.min(edicoes.length - 1, edicaoIndex + 1));
                  }}
                >
                  <Icone nome="seta-direita" tamanho={14} />
                </button>
              </div>
              {edicaoAtual && (
                <div className="bg-cinza-50 rounded-lg p-3 text-sm">
                  <p>Match: <strong>{edicaoAtual.match}</strong></p>
                  {edicaoAtual.comentarios && (
                    <p className="mt-1 text-ardesia">
                      &ldquo;{edicaoAtual.comentarios}&rdquo;
                    </p>
                  )}
                  {edicaoAtual.avaliadorNome && (
                    <p className="text-xs text-ardesia mt-1">
                      Avaliador: {edicaoAtual.avaliadorNome}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {edicoes.length === 0 && (
            <p className="text-sm text-ardesia">Nenhum historico encontrado.</p>
          )}

          {/* Botoes de alocacao */}
          {podeAlocar && (
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                className="btn btn-secundario flex-1"
                disabled={jaTemCoordenador}
                title={jaTemCoordenador ? "Ja existe um coordenador nesta equipe" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdicionar(candidato.pessoaId, "coordenador", candidato.pessoaNome);
                }}
              >
                <Icone nome="usuario-coordenador" tamanho={16} />
                <span className="hidden sm:inline">Coordenador</span>
              </button>
              <button
                type="button"
                className="btn btn-primario flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdicionar(candidato.pessoaId, "equipista", candidato.pessoaNome);
                }}
              >
                <Icone nome="usuario-equipista" tamanho={16} />
                <span className="hidden sm:inline">Equipista</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
