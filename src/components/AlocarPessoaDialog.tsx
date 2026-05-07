import { useEffect, useMemo, useRef, useState } from "react";
import { usePessoas } from "../lib/hooks";
import { normalizar, soDigitos } from "../lib/utilsDominio";
import { FUNCOES, Funcao, Participacao, Pessoa } from "../lib/tipos";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (args: { pessoa: Pessoa; funcao: Funcao }) => Promise<void>;
  participacoesDaEdicao: Participacao[];
  funcaoInicial?: Funcao;
}

const LIMITE = 12;

export function AlocarPessoaDialog({
  aberto,
  onFechar,
  onConfirmar,
  participacoesDaEdicao,
  funcaoInicial = "Equipista",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { itens } = usePessoas();
  const [termo, setTermo] = useState("");
  const [funcao, setFuncao] = useState<Funcao>(funcaoInicial);
  const [destaque, setDestaque] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setTermo("");
      setDestaque(0);
      setErro(null);
      setFuncao(funcaoInicial);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [aberto, funcaoInicial]);

  useEffect(() => {
    if (!aberto) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  const idsAlocados = useMemo(
    () => new Set(participacoesDaEdicao.map((p) => p.pessoaId)),
    [participacoesDaEdicao]
  );

  const resultados = useMemo(() => {
    const t = normalizar(termo);
    const ativos = itens.filter((p) => p.ativo);
    const pontuar = (p: Pessoa): number => {
      if (!t && !termo.trim()) return 1;
      if (String(p.cracha) === termo.trim()) return 1000;
      if (normalizar(p.nome).startsWith(t)) return 100;
      if (normalizar(p.nome).includes(t)) return 50;
      if (soDigitos(p.cpf).includes(soDigitos(termo))) return 30;
      return 0;
    };
    return ativos
      .map((p) => ({ p, pontos: pontuar(p) }))
      .filter((r) => r.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, LIMITE)
      .map((r) => r.p);
  }, [itens, termo]);

  async function escolher(p: Pessoa) {
    if (idsAlocados.has(p.id)) {
      setErro(
        "Esta pessoa já está alocada em outra barraca nesta edição. Mova-a a partir da barraca atual."
      );
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar({ pessoa: p, funcao });
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao alocar.");
    } finally {
      setEnviando(false);
    }
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
      if (escolhido) escolher(escolhido);
    }
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-carbone/40"
      role="dialog"
      aria-modal="true"
      aria-label="Alocar pessoa"
      onClick={onFechar}
    >
      <div
        className="card w-full max-w-xl shadow-media"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-pietra-clara flex flex-wrap items-center gap-3">
          <h4 className="m-0 mr-auto">Alocar pessoa</h4>
          <select
            className="input min-h-[36px] py-1.5"
            value={funcao}
            onChange={(e) => setFuncao(e.target.value as Funcao)}
            disabled={enviando}
          >
            {FUNCOES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="border-b border-pietra-clara px-4 py-3">
          <input
            ref={inputRef}
            className="input border-none p-0 min-h-[36px] focus:ring-0 focus:shadow-none"
            placeholder="Buscar por nome, crachá ou CPF..."
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setDestaque(0);
            }}
            onKeyDown={onKeyDown}
            disabled={enviando}
          />
        </div>
        {erro && (
          <div className="px-4 py-2 text-vermelho-escuro text-sm border-b border-pietra-clara">
            {erro}
          </div>
        )}
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {resultados.length === 0 && (
            <li className="px-4 py-6 text-center text-ardesia text-sm">
              {termo
                ? "Nenhuma pessoa encontrada."
                : "Comece a digitar o nome ou crachá."}
            </li>
          )}
          {resultados.map((p, idx) => {
            const jaAlocada = idsAlocados.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition ${
                    idx === destaque
                      ? "bg-pietra-clara"
                      : "hover:bg-pietra-clara/60"
                  } ${jaAlocada ? "opacity-50" : ""}`}
                  onMouseEnter={() => setDestaque(idx)}
                  onClick={() => escolher(p)}
                  disabled={enviando}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-carbone truncate">
                      {p.nome}
                    </div>
                    <div className="text-xs text-ardesia font-mono">
                      #{p.cracha}
                      {p.email ? ` · ${p.email}` : ""}
                    </div>
                  </div>
                  {jaAlocada && (
                    <span className="badge badge-cinza">já alocada</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-pietra-clara px-4 py-2 text-xs text-ardesia font-mono flex items-center gap-3">
          <span>↑↓ navegar</span>
          <span>↵ alocar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
