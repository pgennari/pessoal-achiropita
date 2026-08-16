import { useState, useEffect, useMemo } from "react";
import {
  useVeiculosEstacionamento,
  useCheckinsEstacionamento,
  useEdicaoAtiva,
  useEquipes,
  useParticipacoes,
} from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { registrarCheckinsManuais } from "../lib/veiculos";
import type { VeiculoComPessoas } from "../lib/tipos";
import { Icone } from "./Icone";

interface Props {
  estacionamentoId: string;
}

function useDebounce(valor: string, atraso: number) {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), atraso);
    return () => clearTimeout(timer);
  }, [valor, atraso]);
  return debounced;
}

// Dias de festa (fins de semana de agosto/2026), numerados de 1 a 10.
const DIAS = [
  { numero: 1, data: "2026-08-01" },
  { numero: 2, data: "2026-08-02" },
  { numero: 3, data: "2026-08-08" },
  { numero: 4, data: "2026-08-09" },
  { numero: 5, data: "2026-08-15" },
  { numero: 6, data: "2026-08-16" },
  { numero: 7, data: "2026-08-22" },
  { numero: 8, data: "2026-08-23" },
  { numero: 9, data: "2026-08-29" },
  { numero: 10, data: "2026-08-30" },
];

function dataLocalISO(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataISO(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

export function ListaVeiculosEstacionamento({ estacionamentoId }: Props) {
  const { sessao } = useSessao();
  const { itens: veiculosEstacionamento, carregando } = useVeiculosEstacionamento(estacionamentoId);
  const { itens: checkins, carregando: carregandoCheckins } = useCheckinsEstacionamento(estacionamentoId);
  const { edicao } = useEdicaoAtiva();
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const [busca, setBusca] = useState("");
  const [filtroCheckin, setFiltroCheckin] = useState<"com" | "sem" | null>(null);
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [veiculoCheckinManual, setVeiculoCheckinManual] = useState<VeiculoComPessoas | null>(null);
  const [diasCheckinSelecionados, setDiasCheckinSelecionados] = useState<Set<string>>(new Set());

  const buscaDebounced = useDebounce(busca, 300);

  const podeCheckinManual = temPermissao(sessao, "estacionamento.checkinManual");

  const checkinsPorVeiculo = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const ck of checkins) {
      if (!ck.carroId) continue;
      const data = dataLocalISO(new Date(ck.timestamp));
      const dias = mapa.get(ck.carroId) ?? new Set<string>();
      dias.add(data);
      mapa.set(ck.carroId, dias);
    }
    return mapa;
  }, [checkins]);

  const equipesPorVeiculo = useMemo(() => {
    const equipesPorId = new Map(equipes.map((e) => [e.id, e.nome]));
    const equipePorPessoa = new Map<string, string>();
    for (const part of participacoes) {
      equipePorPessoa.set(part.pessoaId, equipesPorId.get(part.equipeId) ?? "");
    }
    const m = new Map<string, string[]>();
    for (const v of veiculosEstacionamento) {
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
  }, [veiculosEstacionamento, participacoes, equipes]);

  const veiculosFiltrados = useMemo(() => {
    if (!buscaDebounced.trim()) return veiculosEstacionamento;
    const termo = buscaDebounced.toLowerCase();
    return veiculosEstacionamento.filter(
      (v) =>
        (v.fabricante ?? "").toLowerCase().includes(termo) ||
        (v.modelo ?? "").toLowerCase().includes(termo) ||
        (v.cor ?? "").toLowerCase().includes(termo) ||
        (v.placa ?? "").toLowerCase().includes(termo) ||
        (v.pessoas ?? []).some(
          (p) =>
            (p.nome ?? "").toLowerCase().includes(termo) ||
            String(p.cracha ?? "").includes(termo)
        )
    );
  }, [veiculosEstacionamento, buscaDebounced]);

  const veiculosExibidos = useMemo(() => {
    if (!filtroCheckin) return veiculosFiltrados;
    const hoje = dataLocalISO(new Date());
    return veiculosFiltrados.filter((v) => {
      const diasComCheckin = checkinsPorVeiculo.get(v.id) ?? new Set<string>();
      if (filtroCheckin === "com") {
        return DIAS.some((d) => diasComCheckin.has(d.data));
      }
      return DIAS.some((d) => d.data <= hoje && !diasComCheckin.has(d.data));
    });
  }, [veiculosFiltrados, filtroCheckin, checkinsPorVeiculo]);

  if (!sessao) return null;

  function abrirCheckinManual(veiculo: VeiculoComPessoas) {
    setVeiculoCheckinManual(veiculo);
    setDiasCheckinSelecionados(new Set());
  }

  function alternarDiaCheckin(data: string) {
    setDiasCheckinSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(data)) novo.delete(data);
      else novo.add(data);
      return novo;
    });
  }

  async function confirmarCheckinManual() {
    if (!veiculoCheckinManual) return;
    const datas = Array.from(diasCheckinSelecionados).sort();
    if (datas.length === 0) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await registrarCheckinsManuais(estacionamentoId, veiculoCheckinManual.id, datas);
      setVeiculoCheckinManual(null);
      setDiasCheckinSelecionados(new Set());
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao registrar check-in manual.");
    } finally {
      setAcaoOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-carbone">Veículos vinculados por vaga</h4>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ardesia">
            {veiculosEstacionamento.length} veículo(s)
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-ardesia">
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold transition ${
            filtroCheckin === "com"
              ? "bg-verde/15 text-verde-escuro ring-1 ring-verde/40"
              : "hover:bg-pietra-clara/60"
          }`}
          onClick={() => setFiltroCheckin(filtroCheckin === "com" ? null : "com")}
        >
          <span className="inline-block w-3 h-3 rounded-sm bg-verde" />
          checkin
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold transition ${
            filtroCheckin === "sem"
              ? "bg-vermelho/15 text-vermelho-escuro ring-1 ring-vermelho/40"
              : "hover:bg-pietra-clara/60"
          }`}
          onClick={() => setFiltroCheckin(filtroCheckin === "sem" ? null : "sem")}
        >
          <span className="inline-block w-3 h-3 rounded-sm bg-vermelho" />
          sem checkin
        </button>
        <span className="inline-flex items-center gap-1.5 px-2 py-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-pietra-clara" />
          data futura
        </span>
      </div>

      {acaoErro && (
        <div className="text-sm text-vermelho-escuro">{acaoErro}</div>
      )}

      <input
        type="text"
        className="input"
        placeholder="Buscar por fabricante, modelo, cor, placa, nome ou cracha..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar veículos"
      />

      {carregando ? (
        <p className="text-ardesia text-sm">Carregando...</p>
      ) : veiculosExibidos.length === 0 ? (
        <p className="text-ardesia text-sm">
          {busca.trim() || filtroCheckin
            ? "Nenhum veiculo encontrado com os filtros atuais."
            : "Nenhum veiculo vinculado por vaga."}
        </p>
      ) : (
        <ul className="divide-y divide-pietra-clara" role="list">
          {veiculosExibidos.map((v) => (
            <li
              key={v.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              role="listitem"
            >
              <div>
                <div className="font-mono text-sm text-carbone">
                  {v.placa.toUpperCase()}
                  {(v.pessoas ?? []).length > 0 && (
                    <span className="text-ardesia">
                      {" . "}
                      {(v.pessoas ?? []).map((p) => `#${p.cracha}-${p.nome}`).join(", ")}
                    </span>
                  )}
                </div>
                {(equipesPorVeiculo.get(v.id) ?? []).length > 0 && (
                  <div className="text-[0.65rem] text-ardesia mt-0.5">
                    {(equipesPorVeiculo.get(v.id) ?? []).join(" · ")}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  {DIAS.map((d) => {
                    const temCheckin = checkinsPorVeiculo.get(v.id)?.has(d.data) ?? false;
                    const futuro = d.data > dataLocalISO(new Date());
                    const classe = carregandoCheckins || futuro
                      ? "bg-pietra-clara text-ardesia"
                      : temCheckin
                        ? "bg-verde text-white"
                        : "bg-vermelho text-white";
                    return (
                      <div
                        key={d.numero}
                        title={`Dia ${d.numero} · ${formatarDataISO(d.data)}`}
                        className={`w-6 h-6 rounded-sm flex items-center justify-center font-mono text-xs font-semibold select-none ${classe}`}
                      >
                        {d.numero}
                      </div>
                    );
                  })}
                </div>
              </div>
              {podeCheckinManual && (
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    className="btn btn-secundario btn-pequeno"
                    onClick={() => abrirCheckinManual(v)}
                    disabled={acaoOcupado}
                    aria-label="Check-in manual"
                    title="Check-in manual"
                  >
                    <Icone nome="scan" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {veiculoCheckinManual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-carbone/40"
          role="dialog"
          aria-modal="true"
          aria-label="Check-in manual"
          onClick={() => setVeiculoCheckinManual(null)}
        >
          <div
            className="card w-full max-w-md shadow-media"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-pietra-clara flex items-center justify-between gap-3">
              <h4 className="m-0">Check-in manual</h4>
              <button
                type="button"
                className="text-ardesia hover:text-carbone text-2xl leading-none"
                onClick={() => setVeiculoCheckinManual(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div className="bg-pietra-clara/40 rounded-lg p-3">
                <div className="font-semibold text-carbone">
                  {veiculoCheckinManual.fabricante} {veiculoCheckinManual.modelo}
                </div>
                <div className="text-xs text-ardesia font-mono">
                  {veiculoCheckinManual.placa.toUpperCase()} · {veiculoCheckinManual.cor}
                </div>
              </div>
              <div>
                <p className="text-sm text-ardesia mb-2">
                  Selecione um ou mais dias para registrar o check-in às 23:59.
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {DIAS.map((d) => {
                    const jaTemCheckin = checkinsPorVeiculo.get(veiculoCheckinManual.id)?.has(d.data) ?? false;
                    const selecionado = diasCheckinSelecionados.has(d.data);
                    const classe = jaTemCheckin
                      ? "bg-pietra-clara text-ardesia/70 cursor-not-allowed"
                      : selecionado
                        ? "bg-verde text-white"
                        : "bg-white text-carbone hover:bg-pietra-clara/60 border border-pietra-clara";
                    return (
                      <button
                        key={d.numero}
                        type="button"
                        disabled={jaTemCheckin}
                        title={`Dia ${d.numero} · ${formatarDataISO(d.data)}${jaTemCheckin ? " · já possui check-in" : ""}`}
                        onClick={() => alternarDiaCheckin(d.data)}
                        className={`w-full aspect-square rounded-sm flex flex-col items-center justify-center font-mono text-xs font-semibold select-none transition ${classe}`}
                      >
                        <span>{d.numero}</span>
                        <span className="text-[0.6rem] font-normal leading-none">
                          {formatarDataISO(d.data)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-pietra-clara flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setVeiculoCheckinManual(null)}
                disabled={acaoOcupado}
                aria-label="Cancelar"
                title="Cancelar"
              >
                <Icone nome="fechar" />
              </button>
              <button
                type="button"
                className="btn btn-primario"
                onClick={confirmarCheckinManual}
                disabled={acaoOcupado || diasCheckinSelecionados.size === 0}
                aria-label="Confirmar check-in manual"
                title="Confirmar check-in manual"
              >
                <Icone nome="check" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
