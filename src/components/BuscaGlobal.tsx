import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useEquipes,
  useEdicaoAtiva,
  useEstacionamentos,
  useParticipacoes,
  usePessoas,
  useVeiculos,
} from "../lib/hooks";
import { normalizar, soDigitos } from "../lib/utilsDominio";
import { Funcao, Pessoa, VeiculoComPessoas } from "../lib/tipos";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

interface ContextoEdicao {
  equipeNome?: string;
  funcao?: Funcao;
}

type Resultado =
  | { tipo: "pessoa"; pessoa: Pessoa }
  | { tipo: "veiculo"; veiculo: VeiculoComPessoas };

type ResultadoComPontos = Resultado & { pontos: number };

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

// Espelha a busca da tela de listagem de Veiculos.
function pontuarVeiculo(
  v: VeiculoComPessoas,
  termo: string,
  mapaEstacionamento: Map<string, string>,
  equipesPorVeiculo: Map<string, string[]>
): number {
  const t = normalizar(termo);
  const td = soDigitos(termo);
  if (!t) return 0;
  if (td && soDigitos(v.placa ?? "") === td) return 1000;
  if (normalizar(v.placa ?? "").includes(t)) return 90;
  if (normalizar(v.fabricante ?? "").includes(t)) return 60;
  if (normalizar(v.modelo ?? "").includes(t)) return 60;
  if (normalizar(v.cor ?? "").includes(t)) return 50;
  const estacionamento = v.estacionamentoId
    ? mapaEstacionamento.get(v.estacionamentoId) ?? ""
    : "";
  if (normalizar(estacionamento).includes(t)) return 50;
  if (normalizar(v.observacao ?? "").includes(t)) return 30;
  if (v.pessoas.some((p) => normalizar(p.nome ?? "").includes(t))) return 40;
  if (v.pessoas.some((p) => String(p.cracha ?? "").includes(t))) return 40;
  if (
    (equipesPorVeiculo.get(v.id) ?? []).some((nome) =>
      normalizar(nome ?? "").includes(t)
    )
  )
    return 35;
  if ((t === "sim" || t === "impresso") && v.crachaCarroImpresso) return 45;
  if (t === "nao" && !v.crachaCarroImpresso) return 45;
  return 0;
}

export function BuscaGlobal({ aberto, onFechar }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [termo, setTermo] = useState("");
  const [destaque, setDestaque] = useState(0);
  const { itens } = usePessoas();
  const { itens: veiculos } = useVeiculos();
  const { itens: estacionamentos } = useEstacionamentos();
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

  const mapaEstacionamento = useMemo(
    () => new Map(estacionamentos.map((e) => [e.id, e.nome])),
    [estacionamentos]
  );

  const equipesPorVeiculo = useMemo(() => {
    const equipesPorId = new Map(equipes.map((e) => [e.id, e.nome]));
    const equipePorPessoa = new Map<string, string>();
    for (const part of participacoes) {
      equipePorPessoa.set(part.pessoaId, equipesPorId.get(part.equipeId) ?? "");
    }
    const m = new Map<string, string[]>();
    for (const v of veiculos) {
      const nomes: string[] = [];
      const vistos = new Set<string>();
      for (const p of v.pessoas) {
        const nome = equipePorPessoa.get(p.id);
        if (nome && !vistos.has(nome)) {
          vistos.add(nome);
          nomes.push(nome);
        }
      }
      nomes.sort((a, b) => a.localeCompare(b, "pt-BR"));
      m.set(v.id, nomes);
    }
    return m;
  }, [veiculos, participacoes, equipes]);

  const total = itens.length + veiculos.length;

  const resultados = useMemo(() => {
    let lista: ResultadoComPontos[];
    if (!termo.trim()) {
      lista = [
        ...itens.map((p): ResultadoComPontos => ({ tipo: "pessoa", pessoa: p, pontos: 0 })),
        ...veiculos.map((v): ResultadoComPontos => ({ tipo: "veiculo", veiculo: v, pontos: 0 })),
      ];
    } else {
      lista = [
        ...itens
          .map((p): ResultadoComPontos => ({ tipo: "pessoa", pessoa: p, pontos: pontuar(p, termo) }))
          .filter((r) => r.pontos > 0),
        ...veiculos
          .map((v): ResultadoComPontos => ({
            tipo: "veiculo",
            veiculo: v,
            pontos: pontuarVeiculo(v, termo, mapaEstacionamento, equipesPorVeiculo),
          }))
          .filter((r) => r.pontos > 0),
      ].sort((a, b) => b.pontos - a.pontos);
    }
    return lista;
  }, [itens, veiculos, termo, mapaEstacionamento, equipesPorVeiculo]);

  useEffect(() => {
    setDestaque((d) => Math.min(d, Math.max(resultados.length - 1, 0)));
  }, [resultados.length]);

  function abrir(r: Resultado) {
    onFechar();
    navigate(r.tipo === "veiculo" ? `/veiculos/${r.veiculo.id}` : `/pessoas/${r.pessoa.id}`);
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
            placeholder="Buscar por pessoa, veículo, placa, CPF, e-mail, equipe ou estacionamento..."
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setDestaque(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="px-4 pt-2 pb-1 text-xs text-ardesia font-mono">
          {total > 0 ? `${resultados.length} de ${total} registros` : "Carregando..."}
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-1">
          {resultados.length === 0 && (
            <li className="px-4 py-6 text-center text-ardesia text-sm">
              Nenhum resultado encontrado.
            </li>
          )}
          {resultados.map((r, idx) => {
            const baseClasse = `w-full text-left px-3 py-2 flex items-center gap-3 transition ${
              idx === destaque ? "bg-pietra-clara" : "hover:bg-pietra-clara/60"
            }`;
            if (r.tipo === "veiculo") {
              const v = r.veiculo;
              const estNome = v.estacionamentoId
                ? mapaEstacionamento.get(v.estacionamentoId)
                : undefined;
              const equipesDoVeiculo = equipesPorVeiculo.get(v.id) ?? [];
              const detalhes = [v.fabricante, v.modelo, v.cor].filter(Boolean).join(" ");
              return (
                <li key={`veiculo-${v.id}`}>
                  <button
                    type="button"
                    className={baseClasse}
                    onMouseEnter={() => setDestaque(idx)}
                    onClick={() => abrir(r)}
                  >
                    <div
                      aria-hidden
                      className="h-9 w-9 shrink-0 rounded-full bg-pietra-clara flex items-center justify-center text-ardesia"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                        <circle cx="7" cy="17" r="2" />
                        <path d="M9 17h6" />
                        <circle cx="17" cy="17" r="2" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-carbone font-mono truncate">
                        {v.placa}
                      </div>
                      <div className="text-xs text-ardesia truncate">
                        {detalhes || "Veículo"}
                        {estNome ? ` · ${estNome}` : ""}
                        {equipesDoVeiculo.length > 0
                          ? ` · ${equipesDoVeiculo.join(", ")}`
                          : ""}
                      </div>
                    </div>
                  </button>
                </li>
              );
            }
            const p = r.pessoa;
            const ctx = indiceContexto.get(p.id);
            const inicial = p.nome.trim().charAt(0).toUpperCase() || "?";
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={baseClasse}
                  onMouseEnter={() => setDestaque(idx)}
                  onClick={() => abrir(r)}
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
