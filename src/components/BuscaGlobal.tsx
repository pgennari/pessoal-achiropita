import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useEquipes,
  useEdicaoAtiva,
  useParticipacoes,
  usePessoas,
} from "../lib/hooks";
import { normalizar, soDigitos } from "../lib/utilsDominio";
import { Funcao, Pessoa } from "../lib/tipos";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

const LIMITE = 20;

interface ContextoEdicao {
  equipeNome?: string;
  funcao?: Funcao;
}

function pontuar(p: Pessoa, termo: string): number {
  const n = normalizar(p.nome);
  const t = normalizar(termo);
  if (!t) return 0;
  if (String(p.cracha) === termo.trim()) return 1000;
  if (n.startsWith(t)) return 100;
  if (n.includes(t)) return 50;
  if (soDigitos(p.cpf).includes(soDigitos(termo))) return 30;
  if (normalizar(p.email ?? "").includes(t)) return 20;
  return 0;
}

export function BuscaGlobal({ aberto, onFechar }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [termo, setTermo] = useState("");
  const [destaque, setDestaque] = useState(0);
  const { itens } = usePessoas();
  const { edicao } = useEdicaoAtiva();
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const { itens: equipes } = useEquipes(edicao?.id);

  useEffect(() => {
    if (aberto) {
      setTermo("");
      setDestaque(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  const indiceContexto = useMemo(() => {
    const equipesPorId = new Map(equipes.map((e) => [e.id, e.nome]));
    const m = new Map<string, ContextoEdicao>();
    for (const p of participacoes) {
      m.set(p.pessoaId, {
        equipeNome: equipesPorId.get(p.equipeId),
        funcao: p.funcao,
      });
    }
    return m;
  }, [participacoes, equipes]);

  const resultados = useMemo(() => {
    if (!termo.trim()) return itens.slice(0, LIMITE);
    return itens
      .map((p) => ({ p, pontos: pontuar(p, termo) }))
      .filter((r) => r.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, LIMITE)
      .map((r) => r.p);
  }, [itens, termo]);

  function abrir(p: Pessoa) {
    onFechar();
    navigate(`/pessoas/${p.id}`);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setDestaque((d) => Math.min(d + 1, resultados.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const escolhido = resultados[destaque];
      if (escolhido) abrir(escolhido);
    }
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-carbone/40"
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
      onClick={onFechar}
    >
      <div
        className="card w-full max-w-xl shadow-media"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-pietra-clara px-4 py-3">
          <input
            ref={inputRef}
            className="input border-none p-0 min-h-[36px] focus:ring-0 focus:shadow-none"
            placeholder="Buscar por nome, crachá, CPF ou e-mail..."
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setDestaque(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-1">
          {resultados.length === 0 && (
            <li className="px-4 py-6 text-center text-ardesia text-sm">
              Nenhuma pessoa encontrada.
            </li>
          )}
          {resultados.map((p, idx) => {
            const ctx = indiceContexto.get(p.id);
            const inicial = p.nome.trim().charAt(0).toUpperCase() || "?";
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${
                    idx === destaque
                      ? "bg-pietra-clara"
                      : "hover:bg-pietra-clara/60"
                  }`}
                  onMouseEnter={() => setDestaque(idx)}
                  onClick={() => abrir(p)}
                >
                  <div
                    aria-hidden
                    className="h-9 w-9 shrink-0 rounded-full bg-pietra-clara overflow-hidden flex items-center justify-center text-bianco font-display text-sm"
                    style={
                      p.fotoUrl
                        ? undefined
                        : {
                            background:
                              "linear-gradient(135deg, #2E9D52, #16753A)",
                          }
                    }
                  >
                    {p.fotoUrl ? (
                      <img
                        src={p.fotoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      inicial
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-carbone truncate">
                      {p.nome}
                    </div>
                    <div className="text-xs text-ardesia font-mono truncate">
                      #{p.cracha}
                      {ctx?.equipeNome
                        ? ` · ${ctx.equipeNome} · ${ctx.funcao}`
                        : edicao
                        ? " · sem alocação"
                        : ""}
                    </div>
                  </div>
                  {!p.ativo && <span className="badge badge-cinza">inativo</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-pietra-clara px-4 py-2 text-xs text-ardesia font-mono flex items-center gap-3">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
