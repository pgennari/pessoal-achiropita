// Lista de vagas de um estacionamento (aba Vagas do EstacionamentoDetalhe).
// Cada vaga exibe as pessoas vinculadas (virgulas), as placas (hifen) e os
// quadrados de check-in: verde quando qualquer carro da vaga fez check-in
// naquele dia, em qualquer estacionamento. Com permissao, o botao abre o
// check-in manual da vaga: o operador escolhe o carro e os dias a registrar.
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Vaga, VagaVeiculo } from "../lib/tipos";
import { useSessao, temPermissao } from "../lib/sessao";
import {
  useEdicaoAtiva,
  useDiasFesta,
  useTodosCheckins,
  useCheckinsEstacionamento,
  useDebounce,
} from "../lib/hooks";
import { registrarCheckinsManuais } from "../lib/veiculos";
import { Icone } from "./Icone";

interface Props {
  estacionamentoId: string;
  vagas: Vaga[];
  carregando?: boolean;
}

interface DiaInfo {
  numero: number;
  data: string;
}

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

export function ListaVagas({ estacionamentoId, vagas, carregando }: Props) {
  const { sessao } = useSessao();
  const { edicao } = useEdicaoAtiva();
  const { itens: diasFesta } = useDiasFesta(edicao?.id);
  const { itens: checkins, carregando: carregandoCheckins } = useTodosCheckins();
  const { itens: checkinsEstacionamento } = useCheckinsEstacionamento(estacionamentoId);

  const dias: DiaInfo[] = useMemo(() => {
    return [...diasFesta]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((d, i) => ({ numero: i + 1, data: d.data }));
  }, [diasFesta]);
  const [vagaCheckinManual, setVagaCheckinManual] = useState<Vaga | null>(null);
  const [veiculoCheckinManual, setVeiculoCheckinManual] = useState<VagaVeiculo | null>(null);
  const [diasCheckinSelecionados, setDiasCheckinSelecionados] = useState<Set<string>>(new Set());
  const [acaoOcupado, setAcaoOcupado] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCheckin, setFiltroCheckin] = useState<"com" | "sem" | null>(null);

  const buscaDebounced = useDebounce(busca, 300);
  const podeCheckinManual = temPermissao(sessao, "estacionamento.checkinManual");

  // Dias em que cada carro tem check-in em qualquer estacionamento.
  const diasPorCarro = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ck of checkins) {
      if (!ck.carroId) continue;
      const data = dataLocalISO(new Date(ck.timestamp));
      const conjunto = m.get(ck.carroId) ?? new Set<string>();
      conjunto.add(data);
      m.set(ck.carroId, conjunto);
    }
    return m;
  }, [checkins]);

  // Dias em que cada vaga tem check-in (qualquer carro da vaga, qualquer
  // estacionamento).
  const checkinsPorVaga = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const v of vagas) {
      const conjunto = new Set<string>();
      for (const veiculo of v.veiculos) {
        const diasVeiculo = diasPorCarro.get(veiculo.id);
        if (diasVeiculo) {
          for (const d of diasVeiculo) conjunto.add(d);
        }
      }
      m.set(v.id, conjunto);
    }
    return m;
  }, [vagas, diasPorCarro]);

  // Dias com check-in do carro NESTE estacionamento (desabilita dias no modal).
  const diasDoEstacionamentoPorCarro = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ck of checkinsEstacionamento) {
      if (!ck.carroId) continue;
      const data = dataLocalISO(new Date(ck.timestamp));
      const conjunto = m.get(ck.carroId) ?? new Set<string>();
      conjunto.add(data);
      m.set(ck.carroId, conjunto);
    }
    return m;
  }, [checkinsEstacionamento]);

  const vagasFiltradas = useMemo(() => {
    if (!buscaDebounced.trim()) return vagas;
    const termo = buscaDebounced.toLowerCase();
    return vagas.filter(
      (v) =>
        v.identificacao.toLowerCase().includes(termo) ||
        (v.pessoas ?? []).some(
          (p) =>
            (p.nome ?? "").toLowerCase().includes(termo) ||
            String(p.cracha ?? "").includes(termo)
        ) ||
        (v.veiculos ?? []).some(
          (vc) =>
            (vc.fabricante ?? "").toLowerCase().includes(termo) ||
            (vc.modelo ?? "").toLowerCase().includes(termo) ||
            (vc.cor ?? "").toLowerCase().includes(termo) ||
            (vc.placa ?? "").toLowerCase().includes(termo)
        )
    );
  }, [vagas, buscaDebounced]);

  const vagasExibidas = useMemo(() => {
    if (!filtroCheckin) return vagasFiltradas;
    const hoje = dataLocalISO(new Date());
    return vagasFiltradas.filter((v) => {
      const diasComCheckin = checkinsPorVaga.get(v.id) ?? new Set<string>();
      if (filtroCheckin === "com") {
        return dias.some((d) => diasComCheckin.has(d.data));
      }
      return dias.some((d) => d.data <= hoje && !diasComCheckin.has(d.data));
    });
  }, [vagasFiltradas, filtroCheckin, checkinsPorVaga, dias]);

  if (carregando) {
    return <p className="text-ardesia text-sm">Carregando vagas...</p>;
  }

  function abrirCheckinManual(vaga: Vaga) {
    setVagaCheckinManual(vaga);
    setVeiculoCheckinManual(vaga.veiculos.length === 1 ? vaga.veiculos[0] : null);
    setDiasCheckinSelecionados(new Set());
    setAcaoErro(null);
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
    if (!vagaCheckinManual || !veiculoCheckinManual) return;
    const datas = Array.from(diasCheckinSelecionados).sort();
    if (datas.length === 0) return;
    setAcaoErro(null);
    setAcaoOcupado(true);
    try {
      await registrarCheckinsManuais(estacionamentoId, veiculoCheckinManual.id, datas);
      setVagaCheckinManual(null);
      setVeiculoCheckinManual(null);
      setDiasCheckinSelecionados(new Set());
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : "Falha ao registrar check-in manual.");
    } finally {
      setAcaoOcupado(false);
    }
  }

  const diasJaComCheckin = veiculoCheckinManual
    ? diasDoEstacionamentoPorCarro.get(veiculoCheckinManual.id) ?? new Set<string>()
    : new Set<string>();

  return (
    <div className="space-y-4">
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

      <input
        type="text"
        className="input"
        placeholder="Buscar por identificacao, nome, cracha ou placa..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar vagas"
      />

      {vagasExibidas.length === 0 ? (
        <p className="text-ardesia text-sm">
          {busca.trim() || filtroCheckin
            ? "Nenhuma vaga encontrada com os filtros atuais."
            : "Nenhuma vaga vinculada a este estacionamento."}
        </p>
      ) : (
        <div className="card">
          <div className="card-corpo divide-y divide-pietra-clara">
            {vagasExibidas.map((v) => {
              const nomes = v.pessoas.map((p) => p.nome).join(", ");
              const placas = v.veiculos.map((vc) => vc.placa.toUpperCase()).join(" - ");
              return (
                <div key={v.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link
                      to={`/vagas/${v.id}`}
                      className="font-semibold text-carbone hover:text-verde no-underline hover:underline"
                    >
                      {v.identificacao}
                    </Link>
                    {podeCheckinManual && (
                      <button
                        type="button"
                        className="btn btn-secundario btn-pequeno shrink-0"
                        onClick={() => abrirCheckinManual(v)}
                        disabled={acaoOcupado}
                        aria-label="Check-in manual"
                        title="Check-in manual"
                      >
                        <Icone nome="scan" />
                      </button>
                    )}
                  </div>
                  {nomes && (
                    <div className="text-sm text-carbone mt-1">{nomes}</div>
                  )}
                  {placas && (
                    <div className="font-mono text-sm text-ardesia mt-0.5">
                      {placas}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {dias.map((d) => {
                      const temCheckin = checkinsPorVaga.get(v.id)?.has(d.data) ?? false;
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
              );
            })}
          </div>
        </div>
      )}

      {vagaCheckinManual && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-carbone/40"
          role="dialog"
          aria-modal="true"
          aria-label="Check-in manual"
          onClick={() => setVagaCheckinManual(null)}
        >
          <div
            className="card w-full max-w-md shadow-media flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-pietra-clara flex items-center justify-between gap-3 shrink-0">
              <h4 className="m-0">Check-in manual</h4>
              <button
                type="button"
                className="text-ardesia hover:text-carbone text-2xl leading-none"
                onClick={() => setVagaCheckinManual(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="px-4 py-4 space-y-4 overflow-y-auto">
              <div className="bg-pietra-clara/40 rounded-lg p-3">
                <div className="font-semibold text-carbone">
                  {vagaCheckinManual.identificacao}
                </div>
                <div className="text-xs text-ardesia">
                  {vagaCheckinManual.pessoas.map((p) => p.nome).join(", ") ||
                    "Sem pessoas vinculadas"}
                </div>
              </div>

              <div>
                <p className="text-sm text-ardesia mb-2">
                  Selecione o carro que sera registrado no check-in.
                </p>
                {vagaCheckinManual.veiculos.length === 0 ? (
                  <p className="text-sm text-vermelho-escuro">
                    Nenhum carro vinculado a esta vaga.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {vagaCheckinManual.veiculos.map((vc) => {
                      const selecionado = veiculoCheckinManual?.id === vc.id;
                      const classe = selecionado
                        ? "border-verde bg-verde/10"
                        : "border-pietra-clara bg-white hover:bg-pietra-clara/40";
                      return (
                        <button
                          key={vc.id}
                          type="button"
                          onClick={() => setVeiculoCheckinManual(vc)}
                          className={`w-full rounded-lg border p-3 text-left transition ${classe}`}
                        >
                          <div className="font-mono font-semibold text-carbone">
                            {vc.placa.toUpperCase()}
                          </div>
                          <div className="text-xs text-ardesia">
                            {vc.fabricante} {vc.modelo} · {vc.cor}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {veiculoCheckinManual && (
                <div>
                  <p className="text-sm text-ardesia mb-2">
                    Selecione um ou mais dias para registrar o check-in às 23:59.
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {dias.map((d) => {
                      const jaTemCheckin = diasJaComCheckin.has(d.data);
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
              )}

              {acaoErro && (
                <div className="text-sm text-vermelho-escuro">{acaoErro}</div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-pietra-clara flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setVagaCheckinManual(null)}
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
                disabled={acaoOcupado || !veiculoCheckinManual || diasCheckinSelecionados.size === 0}
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
