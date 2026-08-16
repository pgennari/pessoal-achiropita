// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado (rota protegida). Sem permissao especial.
// ============================================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useDiasFesta,
  useEdicaoAtiva,
  useEquipes,
  useParticipacoes,
  useTodosCheckins,
  useVeiculos,
} from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { normalizar } from "../lib/utilsDominio";

interface DiaRelatorio {
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

export function RelatorioEstacionamentos() {
  const { sessao } = useSessao();
  const { itens: veiculos, carregando, erro } = useVeiculos();
  const { itens: checkins, carregando: carregandoCheckins } = useTodosCheckins();
  const { edicao } = useEdicaoAtiva();
  const { itens: diasFesta } = useDiasFesta(edicao?.id);
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const [termo, setTermo] = useState("");
  const [filtroBarraca, setFiltroBarraca] = useState("");
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroEstacionamento, setFiltroEstacionamento] = useState("");
  const [filtroCheckin, setFiltroCheckin] = useState<"com" | "sem" | null>(null);
  const [filtroTotal, setFiltroTotal] = useState<number | null>(null);

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

  const dias = useMemo<DiaRelatorio[]>(
    () =>
      [...diasFesta]
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((d, i) => ({ numero: i + 1, data: d.data })),
    [diasFesta]
  );

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
    const b = normalizar(filtroBarraca);
    const n = normalizar(filtroNome);
    const p = normalizar(filtroPlaca);
    const e = normalizar(filtroEstacionamento);
    const hoje = dataLocalISO(new Date());

    return veiculosOrdenados.filter((v) => {
      if (t) {
        const estacionamento = (v.estacionamentos ?? []).map((e) => e.nome).join(", ");
        const total = checkinsPorVeiculo.totais.get(v.id) ?? 0;
        const combina =
          normalizar(v.placa ?? "").includes(t) ||
          normalizar(estacionamento).includes(t) ||
          String(total).includes(t) ||
          v.pessoas.some(
            (pp) =>
              normalizar(pp.nome ?? "").includes(t) ||
              String(pp.cracha ?? "").includes(t)
          ) ||
          (equipesPorVeiculo.get(v.id) ?? []).some((nome) =>
            normalizar(nome).includes(t)
          );
        if (!combina) return false;
      }
      if (b) {
        const equipes = equipesPorVeiculo.get(v.id) ?? [];
        if (!equipes.some((nome) => normalizar(nome).includes(b))) return false;
      }
      if (n) {
        if (!v.pessoas.some((pp) => normalizar(pp.nome ?? "").includes(n)))
          return false;
      }
      if (p) {
        if (!normalizar(v.placa ?? "").includes(p)) return false;
      }
      if (e) {
        const estac = (v.estacionamentos ?? []).map((est) => est.nome).join(", ");
        if (!normalizar(estac).includes(e)) return false;
      }
      if (filtroTotal !== null) {
        const total = checkinsPorVeiculo.totais.get(v.id) ?? 0;
        if (total !== filtroTotal) return false;
      }
      if (filtroCheckin) {
        const diasComCheckin =
          checkinsPorVeiculo.dias.get(v.id) ?? new Set<string>();
        if (filtroCheckin === "com") {
          if (!dias.some((d) => diasComCheckin.has(d.data))) return false;
        } else {
          if (!dias.some((d) => d.data <= hoje && !diasComCheckin.has(d.data)))
            return false;
        }
      }
      return true;
    });
  }, [
    veiculosOrdenados,
    termo,
    filtroBarraca,
    filtroNome,
    filtroPlaca,
    filtroEstacionamento,
    equipesPorVeiculo,
    checkinsPorVeiculo,
    filtroCheckin,
    filtroTotal,
  ]);

  const filtrosAtivos =
    termo.trim() !== "" ||
    filtroBarraca !== "" ||
    filtroNome !== "" ||
    filtroPlaca !== "" ||
    filtroEstacionamento !== "" ||
    filtroCheckin !== null ||
    filtroTotal !== null;

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
            <span className="inline-flex items-center gap-1.5 px-2 py-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-verde" />
              checkin
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-vermelho" />
              sem checkin
            </span>
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

      {!erro && (
        <div className="card">
          <div className="card-corpo">
            <p className="text-ardesia text-sm text-right mb-4">
              {carregando ? "Carregando..." : `${veiculosFiltrados.length} de ${veiculos.length} registros`}
            </p>
            <div className="tabela-rolavel">
              <table className="tabela-larga">
              <thead>
                <tr className="border-b border-pietra">
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia whitespace-nowrap">
                    Barraca
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia whitespace-nowrap">
                    Nome
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia whitespace-nowrap">
                    Placa
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia whitespace-nowrap">
                    Estacionamento
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia whitespace-nowrap">
                    Total
                  </th>
                  <th className="text-left py-0.5 px-1 font-medium text-ardesia whitespace-nowrap">
                    Check-ins
                  </th>
                </tr>
                <tr className="border-b border-pietra align-top">
                  <th className="py-1 px-1">
                    <input
                      type="text"
                      className="filtro-coluna"
                      placeholder="Filtrar barraca..."
                      aria-label="Filtrar por barraca"
                      value={filtroBarraca}
                      onChange={(e) => setFiltroBarraca(e.target.value)}
                    />
                  </th>
                  <th className="py-1 px-1">
                    <input
                      type="text"
                      className="filtro-coluna"
                      placeholder="Filtrar nome..."
                      aria-label="Filtrar por nome"
                      value={filtroNome}
                      onChange={(e) => setFiltroNome(e.target.value)}
                    />
                  </th>
                  <th className="py-1 px-1">
                    <input
                      type="text"
                      className="filtro-coluna font-mono"
                      placeholder="Filtrar placa..."
                      aria-label="Filtrar por placa"
                      value={filtroPlaca}
                      onChange={(e) => setFiltroPlaca(e.target.value)}
                    />
                  </th>
                  <th className="py-1 px-1">
                    <input
                      type="text"
                      className="filtro-coluna"
                      placeholder="Filtrar estac..."
                      aria-label="Filtrar por estacionamento"
                      value={filtroEstacionamento}
                      onChange={(e) => setFiltroEstacionamento(e.target.value)}
                    />
                  </th>
                  <th className="py-1 px-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="filtro-coluna text-center font-mono"
                      placeholder="Todos"
                      aria-label="Filtrar por total de check-ins"
                      value={filtroTotal === null ? "" : filtroTotal}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D+/g, "");
                        setFiltroTotal(digitos === "" ? null : Number(digitos));
                      }}
                    />
                  </th>
                  <th className="py-1 px-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-1 font-semibold text-xs transition ${
                          filtroCheckin === "com"
                            ? "bg-verde/15 text-verde-escuro ring-1 ring-verde/40"
                            : "hover:bg-pietra-clara/60"
                        }`}
                        aria-pressed={filtroCheckin === "com"}
                        onClick={() =>
                          setFiltroCheckin(filtroCheckin === "com" ? null : "com")
                        }
                      >
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-verde" />
                        com
                      </button>
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-1 font-semibold text-xs transition ${
                          filtroCheckin === "sem"
                            ? "bg-vermelho/15 text-vermelho-escuro ring-1 ring-vermelho/40"
                            : "hover:bg-pietra-clara/60"
                        }`}
                        aria-pressed={filtroCheckin === "sem"}
                        onClick={() =>
                          setFiltroCheckin(filtroCheckin === "sem" ? null : "sem")
                        }
                      >
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-vermelho" />
                        sem
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {veiculosFiltrados.length === 0 ? (
                  <tr className="border-b border-pietra-clara">
                    <td
                      colSpan={6}
                      className="py-6 text-center text-ardesia text-sm"
                    >
                      {carregando
                        ? "Carregando..."
                        : filtrosAtivos
                          ? "Nenhum veiculo encontrado com os filtros atuais."
                          : "Nenhum veiculo cadastrado."}
                    </td>
                  </tr>
                ) : (
                  veiculosFiltrados.map((v) => {
                  const equipesVeiculo = equipesPorVeiculo.get(v.id) ?? [];
                  const estacionamentoNome = (v.estacionamentos ?? [])
                    .map((e) => e.nome)
                    .join(", ");
                  const total = checkinsPorVeiculo.totais.get(v.id) ?? 0;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-pietra-clara hover:bg-pietra-clara/50"
                    >
                      <td className="py-0.5 px-0.5 whitespace-nowrap">
                        {equipesVeiculo.length > 0
                          ? equipesVeiculo.join(" · ")
                          : "-"}
                      </td>
                      <td className="py-0.5 px-0.5 whitespace-nowrap">
                        {v.pessoas.length > 0
                          ? v.pessoas.map((p) => p.nome).join(", ")
                          : "-"}
                      </td>
                      <td className="py-0.5 px-0.5 font-mono font-medium whitespace-nowrap">
                        {v.placa}
                      </td>
                      <td className="py-0.5 px-0.5 whitespace-nowrap">
                        {estacionamentoNome || "-"}
                      </td>
                      <td className="py-0.5 px-0.5 font-mono font-semibold whitespace-nowrap">
                        {carregandoCheckins ? "-" : total}
                      </td>
                      <td className="py-0.5 px-0.5">
                        <div className="flex flex-nowrap items-center gap-0.5">
                          {dias.map((d) => {
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
                })
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
