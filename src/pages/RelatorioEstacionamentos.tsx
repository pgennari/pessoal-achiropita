// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado (rota protegida). Sem permissao especial.
// ============================================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useEdicaoAtiva,
  useEquipes,
  useEstacionamentos,
  useParticipacoes,
  useTodosCheckins,
  useVeiculos,
} from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { normalizar } from "../lib/utilsDominio";

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

export function RelatorioEstacionamentos() {
  const { sessao } = useSessao();
  const { itens: veiculos, carregando, erro } = useVeiculos();
  const { itens: estacionamentos } = useEstacionamentos();
  const { itens: checkins, carregando: carregandoCheckins } = useTodosCheckins();
  const { edicao } = useEdicaoAtiva();
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const [termo, setTermo] = useState("");
  const [filtroCheckin, setFiltroCheckin] = useState<"com" | "sem" | null>(null);
  const [filtroTotal, setFiltroTotal] = useState<number | null>(null);

  const mapaEstacionamento = useMemo(
    () => new Map(estacionamentos.map((e) => [e.id, e.nome])),
    [estacionamentos]
  );

  const equipesPorPessoa = useMemo(() => {
    const equipesPorId = new Map(equipes.map((e) => [e.id, e.nome]));
    const m = new Map<string, string>();
    for (const part of participacoes) {
      m.set(part.pessoaId, equipesPorId.get(part.equipeId) ?? "");
    }
    return m;
  }, [participacoes, equipes]);

  const equipesPorVeiculo = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of veiculos) {
      const nomes: string[] = [];
      const vistos = new Set<string>();
      for (const p of v.pessoas) {
        const nome = equipesPorPessoa.get(p.id);
        if (nome && !vistos.has(nome)) {
          vistos.add(nome);
          nomes.push(nome);
        }
      }
      nomes.sort((a, b) => a.localeCompare(b, "pt-BR"));
      m.set(v.id, nomes);
    }
    return m;
  }, [veiculos, equipesPorPessoa]);

  const checkinsPorVeiculo = useMemo(() => {
    const dias = new Map<string, Set<string>>();
    const totais = new Map<string, number>();
    for (const ck of checkins) {
      if (!ck.carroId) continue;
      const data = dataLocalISO(new Date(ck.timestamp));
      const conjunto = dias.get(ck.carroId) ?? new Set<string>();
      conjunto.add(data);
      dias.set(ck.carroId, conjunto);
      totais.set(ck.carroId, (totais.get(ck.carroId) ?? 0) + 1);
    }
    return { dias, totais };
  }, [checkins]);

  const veiculosOrdenados = useMemo(
    () =>
      [...veiculos].sort((a, b) =>
        (a.placa ?? "").localeCompare(b.placa ?? "", "pt-BR")
      ),
    [veiculos]
  );

  const veiculosFiltrados = useMemo(() => {
    const t = normalizar(termo);
    const hoje = dataLocalISO(new Date());
    const base = t
      ? veiculosOrdenados.filter((v) => {
          const estacionamento = v.estacionamentoId
            ? mapaEstacionamento.get(v.estacionamentoId) ?? ""
            : "";
          const total = checkinsPorVeiculo.totais.get(v.id) ?? 0;
          if (normalizar(v.placa ?? "").includes(t)) return true;
          if (normalizar(estacionamento).includes(t)) return true;
          if (String(total).includes(t)) return true;
          if (
            v.pessoas.some(
              (p) =>
                normalizar(p.nome ?? "").includes(t) ||
                String(p.cracha ?? "").includes(t)
            )
          )
            return true;
          return (equipesPorVeiculo.get(v.id) ?? []).some((nome) =>
            normalizar(nome).includes(t)
          );
        })
      : veiculosOrdenados;

    let resultado = base;
    if (filtroTotal !== null) {
      resultado = resultado.filter((v) => {
        const total = checkinsPorVeiculo.totais.get(v.id) ?? 0;
        return total === filtroTotal;
      });
    }
    if (filtroCheckin) {
      resultado = resultado.filter((v) => {
        const diasComCheckin =
          checkinsPorVeiculo.dias.get(v.id) ?? new Set<string>();
        if (filtroCheckin === "com") {
          return DIAS.some((d) => diasComCheckin.has(d.data));
        }
        return DIAS.some((d) => d.data <= hoje && !diasComCheckin.has(d.data));
      });
    }
    return resultado;
  }, [
    veiculosOrdenados,
    termo,
    mapaEstacionamento,
    equipesPorVeiculo,
    checkinsPorVeiculo,
    filtroCheckin,
    filtroTotal,
  ]);

  if (!sessao) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/estacionamentos" className="eyebrow">
            ← Estacionamentos
          </Link>
          <h2 className="mt-1">Relatório</h2>
        </div>
      </header>

      <div className="card">
        <div className="card-corpo space-y-3">
          <input
            type="text"
            className="input"
            placeholder="Filtrar por barraca, nome, placa, estacionamento ou total de check-ins..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            aria-label="Filtrar relatorio"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-ardesia">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              Total check-ins:
              <span className="inline-flex items-center">
                <button
                  type="button"
                  aria-label="Diminuir filtro de total de check-ins"
                  className="w-7 h-7 inline-flex items-center justify-center rounded-sm border-[1.5px] border-pietra bg-bianco text-carbone font-semibold leading-none transition hover:border-verde hover:text-verde disabled:opacity-45 disabled:pointer-events-none"
                  onClick={() =>
                    setFiltroTotal((v) => (v === null ? v : v === 0 ? null : v - 1))
                  }
                  disabled={filtroTotal === null}
                >
                  −
                </button>
                <span
                  className={`w-9 h-7 inline-flex items-center justify-center font-mono text-xs font-semibold ${
                    filtroTotal !== null ? "text-verde-escuro" : "text-ardesia"
                  }`}
                >
                  {filtroTotal ?? ""}
                </span>
                <button
                  type="button"
                  aria-label="Aumentar filtro de total de check-ins"
                  className="w-7 h-7 inline-flex items-center justify-center rounded-sm border-[1.5px] border-pietra bg-bianco text-carbone font-semibold leading-none transition hover:border-verde hover:text-verde disabled:opacity-45 disabled:pointer-events-none"
                  onClick={() =>
                    setFiltroTotal((v) => (v === null ? 0 : Math.min(10, v + 1)))
                  }
                  disabled={filtroTotal !== null && filtroTotal >= 10}
                >
                  +
                </button>
              </span>
            </span>
            <span className="inline-block w-px h-5 bg-pietra" />
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold transition ${
                filtroCheckin === "com"
                  ? "bg-verde/15 text-verde-escuro ring-1 ring-verde/40"
                  : "hover:bg-pietra-clara/60"
              }`}
              onClick={() =>
                setFiltroCheckin(filtroCheckin === "com" ? null : "com")
              }
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
              onClick={() =>
                setFiltroCheckin(filtroCheckin === "sem" ? null : "sem")
              }
            >
              <span className="inline-block w-3 h-3 rounded-sm bg-vermelho" />
              sem checkin
            </button>
            <span className="inline-flex items-center gap-1.5 px-2 py-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-pietra-clara" />
              data futura
            </span>
          </div>
        </div>
      </div>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {!carregando && veiculosFiltrados.length === 0 && !erro && (
        <div className="card">
          <div className="card-corpo">
            <p className="text-ardesia text-sm text-right mb-4">
              {veiculosFiltrados.length} de {veiculos.length} registros
            </p>
            <p className="text-center text-ardesia">
              {termo.trim() || filtroCheckin || filtroTotal !== null
                ? "Nenhum veiculo encontrado com os filtros atuais."
                : "Nenhum veiculo cadastrado."}
            </p>
          </div>
        </div>
      )}

      {veiculosFiltrados.length > 0 && (
        <div className="card">
          <div className="card-corpo">
            <p className="text-ardesia text-sm text-right mb-4">
              {carregando ? "Carregando..." : `${veiculosFiltrados.length} de ${veiculos.length} registros`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pietra">
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia">
                    Barraca
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia">
                    Nome
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia">
                    Placa
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia">
                    Estacionamento
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia">
                    Total
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia">
                    Check-ins
                  </th>
                </tr>
              </thead>
              <tbody>
                {veiculosFiltrados.map((v) => {
                  const equipesVeiculo = equipesPorVeiculo.get(v.id) ?? [];
                  const estacionamentoNome = v.estacionamentoId
                    ? mapaEstacionamento.get(v.estacionamentoId) ?? ""
                    : "";
                  const total = checkinsPorVeiculo.totais.get(v.id) ?? 0;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-pietra-clara hover:bg-pietra-clara/50 align-top"
                    >
                      <td className="py-0.5 px-0.5">
                        {equipesVeiculo.length > 0
                          ? equipesVeiculo.join(" · ")
                          : "-"}
                      </td>
                      <td className="py-0.5 px-0.5">
                        {v.pessoas.length > 0
                          ? v.pessoas.map((p) => p.nome).join(", ")
                          : "-"}
                      </td>
                      <td className="py-0.5 px-0.5 font-mono font-medium">
                        {v.placa}
                      </td>
                      <td className="py-0.5 px-0.5">
                        {estacionamentoNome || "-"}
                      </td>
                      <td className="py-0.5 px-0.5 font-mono font-semibold">
                        {carregandoCheckins ? "-" : total}
                      </td>
                      <td className="py-0.5 px-0.5">
                        <div className="flex flex-wrap items-center gap-0.5">
                          {DIAS.map((d) => {
                            const temCheckin =
                              checkinsPorVeiculo.dias
                                .get(v.id)
                                ?.has(d.data) ?? false;
                            const futuro = d.data > dataLocalISO(new Date());
                            const classe =
                              carregandoCheckins || futuro
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
