import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate } from "react-router-dom";
import {
  useEquipes,
  useEdicaoAtiva,
  useParticipacoes,
  usePessoas,
  useVeiculos,
  useDebounce,
} from "../lib/hooks";
import { normalizar, soDigitos } from "../lib/utilsDominio";
import { Equipe, Funcao, Pessoa, SETORES, VeiculoComPessoas } from "../lib/tipos";

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
  | { tipo: "veiculo"; veiculo: VeiculoComPessoas }
  | { tipo: "equipe"; equipe: Equipe };

type ResultadoComPontos = Resultado & { pontos: number };

// ── Limites para termo vazio ──────────────────────────────────────────────────
const LIMITE_PESSOAS_VAZIO = 30;
const LIMITE_VEICULOS_VAZIO = 20;
const LIMITE_EQUIPES_VAZIO = 10;

// ── Altura estimada de cada item na lista virtualizada ────────────────────────
const ALTURA_ITEM = 52;

// ── Índices pré-computados para evitar normalização repetida ──────────────────
interface IndicePessoa {
  pessoa: Pessoa;
  nomeNorm: string;
  crachaStr: string;
  cpfDigitos: string;
  emailNorm: string;
}

interface IndiceVeiculo {
  veiculo: VeiculoComPessoas;
  placaNorm: string;
  placaDigitos: string;
  fabricanteNorm: string;
  modeloNorm: string;
  corNorm: string;
  estacionamentoNorm: string;
  observacaoNorm: string;
  pessoasNorm: string[];
  pessoasCracha: string[];
}

interface IndiceEquipe {
  equipe: Equipe;
  nomeNorm: string;
  setorNorm: string;
}

function construirIndices(
  pessoas: Pessoa[],
  veiculos: VeiculoComPessoas[],
  equipes: Equipe[]
) {
  const indicePessoas: IndicePessoa[] = pessoas.map((p) => ({
    pessoa: p,
    nomeNorm: normalizar(p.nome),
    crachaStr: String(p.cracha),
    cpfDigitos: soDigitos(p.cpf),
    emailNorm: normalizar(p.email ?? ""),
  }));

  const indiceVeiculos: IndiceVeiculo[] = veiculos.map((v) => ({
    veiculo: v,
    placaNorm: normalizar(v.placa ?? ""),
    placaDigitos: soDigitos(v.placa ?? ""),
    fabricanteNorm: normalizar(v.fabricante ?? ""),
    modeloNorm: normalizar(v.modelo ?? ""),
    corNorm: normalizar(v.cor ?? ""),
    estacionamentoNorm: normalizar(
      (v.estacionamentos ?? []).map((e) => e.nome).join(" ")
    ),
    observacaoNorm: normalizar(v.observacao ?? ""),
    pessoasNorm: v.pessoas.map((p) => normalizar(p.nome ?? "")),
    pessoasCracha: v.pessoas.map((p) => String(p.cracha ?? "")),
  }));

  const indiceEquipes: IndiceEquipe[] = equipes.map((e) => ({
    equipe: e,
    nomeNorm: normalizar(e.nome),
    setorNorm: normalizar(e.setor),
  }));

  return { indicePessoas, indiceVeiculos, indiceEquipes };
}

// ── Scoring com índices pré-computados ────────────────────────────────────────

function pontuar(p: IndicePessoa, termo: string): number {
  const t = normalizar(termo);
  if (!t) return 0;
  if (p.crachaStr === termo.trim()) return 1000;
  if (p.nomeNorm.startsWith(t)) return 100;
  if (p.nomeNorm.includes(t)) return 50;
  if (p.cpfDigitos.includes(soDigitos(termo))) return 30;
  if (p.emailNorm.includes(t)) return 20;
  return 0;
}

function pontuarVeiculo(
  v: IndiceVeiculo,
  termo: string,
  equipesPorVeiculo: Map<string, string[]>
): number {
  const t = normalizar(termo);
  const td = soDigitos(termo);
  if (!t) return 0;
  if (td && v.placaDigitos === td) return 1000;
  if (v.placaNorm.includes(t)) return 90;
  if (v.fabricanteNorm.includes(t)) return 60;
  if (v.modeloNorm.includes(t)) return 60;
  if (v.corNorm.includes(t)) return 50;
  if (v.estacionamentoNorm.includes(t)) return 50;
  if (v.observacaoNorm.includes(t)) return 30;
  if (v.pessoasNorm.some((n) => n.includes(t))) return 40;
  if (v.pessoasCracha.some((c) => c.includes(t))) return 40;
  if (
    (equipesPorVeiculo.get(v.veiculo.id) ?? []).some((nome) =>
      normalizar(nome ?? "").includes(t)
    )
  )
    return 35;
  if ((t === "sim" || t === "impresso") && v.veiculo.crachaCarroImpresso) return 45;
  if (t === "nao" && !v.veiculo.crachaCarroImpresso) return 45;
  return 0;
}

function pontuarEquipe(e: IndiceEquipe, termo: string): number {
  const t = normalizar(termo);
  if (!t) return 0;
  if (e.nomeNorm.startsWith(t)) return 100;
  if (e.nomeNorm.includes(t)) return 50;
  if (e.setorNorm.includes(t)) return 20;
  return 0;
}

export function BuscaGlobal({ aberto, onFechar }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const [termo, setTermo] = useState("");
  const termoDebounced = useDebounce(termo, 200);
  const [destaque, setDestaque] = useState(0);
  const { itens } = usePessoas();
  const { itens: veiculos } = useVeiculos();
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

  const total = itens.length + veiculos.length + equipes.length;

  // ── Índices pré-computados (uma única vez por mudança nos dados) ──────────
  const { indicePessoas, indiceVeiculos, indiceEquipes } = useMemo(
    () => construirIndices(itens, veiculos, equipes),
    [itens, veiculos, equipes]
  );

  // ── Busca com debounce + limitação quando vazio ──────────────────────────
  const resultados = useMemo(() => {
    let lista: ResultadoComPontos[];
    if (!termoDebounced.trim()) {
      const pessoasAtivas = indicePessoas
        .filter((p) => p.pessoa.ativo)
        .slice(0, LIMITE_PESSOAS_VAZIO);
      const pessoasInativas = indicePessoas
        .filter((p) => !p.pessoa.ativo)
        .slice(0, LIMITE_PESSOAS_VAZIO - pessoasAtivas.length);
      lista = [
        ...pessoasAtivas
          .concat(pessoasInativas)
          .map((p): ResultadoComPontos => ({ tipo: "pessoa", pessoa: p.pessoa, pontos: 0 })),
        ...indiceVeiculos
          .slice(0, LIMITE_VEICULOS_VAZIO)
          .map((v): ResultadoComPontos => ({ tipo: "veiculo", veiculo: v.veiculo, pontos: 0 })),
        ...indiceEquipes
          .slice(0, LIMITE_EQUIPES_VAZIO)
          .map((e): ResultadoComPontos => ({ tipo: "equipe", equipe: e.equipe, pontos: 0 })),
      ];
    } else {
      lista = [
        ...indicePessoas
          .map((p): ResultadoComPontos => ({ tipo: "pessoa", pessoa: p.pessoa, pontos: pontuar(p, termoDebounced) }))
          .filter((r) => r.pontos > 0),
        ...indiceVeiculos
          .map((v): ResultadoComPontos => ({
            tipo: "veiculo",
            veiculo: v.veiculo,
            pontos: pontuarVeiculo(v, termoDebounced, equipesPorVeiculo),
          }))
          .filter((r) => r.pontos > 0),
        ...indiceEquipes
          .map((e): ResultadoComPontos => ({
            tipo: "equipe",
            equipe: e.equipe,
            pontos: pontuarEquipe(e, termoDebounced),
          }))
          .filter((r) => r.pontos > 0),
      ].sort((a, b) => {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        if (a.tipo === "pessoa" && b.tipo === "pessoa") {
          if (a.pessoa.ativo !== b.pessoa.ativo) return a.pessoa.ativo ? -1 : 1;
        }
        return 0;
      });
    }
    return lista;
  }, [indicePessoas, indiceVeiculos, indiceEquipes, termoDebounced, equipesPorVeiculo]);

  useEffect(() => {
    setDestaque((d) => Math.min(d, Math.max(resultados.length - 1, 0)));
  }, [resultados.length]);

  // ── Virtualização ───────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: resultados.length,
    getScrollElement: () => listaRef.current,
    estimateSize: () => ALTURA_ITEM,
    overscan: 5,
  });

  function abrir(r: Resultado) {
    onFechar();
    if (r.tipo === "equipe") {
      navigate(`/edicoes/${r.equipe.edicaoId}/equipes/${r.equipe.id}`);
      return;
    }
    navigate(r.tipo === "veiculo" ? `/veiculos/${r.veiculo.id}` : `/pessoas/${r.pessoa.id}`);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setDestaque((d) => Math.min(d + 1, resultados.length - 1));
      virtualizer.scrollToIndex(Math.min(destaque + 1, resultados.length - 1), { align: "auto" });
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
      virtualizer.scrollToIndex(Math.max(destaque - 1, 0), { align: "auto" });
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
        <div
          ref={listaRef}
          className="max-h-[55vh] overflow-y-auto py-1"
        >
          {resultados.length === 0 && (
            <div className="px-4 py-6 text-center text-ardesia text-sm">
              Nenhum resultado encontrado.
            </div>
          )}
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const r = resultados[virtualRow.index];
              const idx = virtualRow.index;
              const baseClasse = `w-full text-left px-3 py-2 flex items-center gap-3 transition ${
                idx === destaque ? "bg-pietra-clara" : "hover:bg-pietra-clara/60"
              }`;

              if (r.tipo === "veiculo") {
                const v = r.veiculo;
                const estNome = (v.estacionamentos ?? []).map((e) => e.nome).join(", ");
                const equipesDoVeiculo = equipesPorVeiculo.get(v.id) ?? [];
                const detalhes = [v.fabricante, v.modelo, v.cor].filter(Boolean).join(" ");
                return (
                  <div
                    key={`veiculo-${v.id}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
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
                  </div>
                );
              }

              if (r.tipo === "equipe") {
                const e = r.equipe;
                const rotuloSetor =
                  SETORES.find((s) => s.valor === e.setor)?.rotulo ?? e.setor;
                return (
                  <div
                    key={`equipe-${e.id}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
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
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-carbone truncate">
                          {e.nome}
                        </div>
                        <div className="text-xs text-ardesia font-mono truncate">
                          Equipe · {rotuloSetor}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              }

              const p = r.pessoa;
              const ctx = indiceContexto.get(p.id);
              const inicial = p.nome.trim().charAt(0).toUpperCase() || "?";
              return (
                <div
                  key={p.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
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
                    {p.bloqueada && (
                      <span className="badge badge-vermelho">bloqueado</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="border-t border-pietra-clara px-4 py-2 text-xs text-ardesia font-mono flex items-center gap-3">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
