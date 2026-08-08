// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: qualquer perfil autenticado. Criar: podeAdministrar (ADM/ORG).
// ============================================================================
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useEdicaoAtiva,
  useEquipes,
  useEstacionamentos,
  useParticipacoes,
  useVeiculos,
} from "../lib/hooks";
import { useSessao, podeAdministrar as adminPode } from "../lib/sessao";
import { normalizar } from "../lib/utilsDominio";
import type { VeiculoComPessoas } from "../lib/tipos";
import { Icone } from "../components/Icone";

type ColunaOrdenacao =
  | "placa"
  | "estacionamento"
  | "pessoas"
  | "equipes"
  | "fabricante"
  | "modelo"
  | "cor"
  | "observacao"
  | "impresso";

type Ordenacao = { coluna: ColunaOrdenacao; direcao: "asc" | "desc" };

function valorOrdenacao(
  v: VeiculoComPessoas,
  coluna: ColunaOrdenacao,
  mapaEstacionamento: Map<string, string>,
  equipes: string[]
): string {
  switch (coluna) {
    case "placa":
      return v.placa ?? "";
    case "fabricante":
      return v.fabricante ?? "";
    case "modelo":
      return v.modelo ?? "";
    case "cor":
      return v.cor ?? "";
    case "estacionamento":
      return v.estacionamentoId
        ? mapaEstacionamento.get(v.estacionamentoId) ?? ""
        : "";
    case "pessoas":
      return v.pessoas.map((p) => p.nome).join(" ");
    case "equipes":
      return equipes.join(" ");
    case "observacao":
      return v.observacao ?? "";
    case "impresso":
      return v.crachaCarroImpresso ? "1" : "0";
  }
}

const CORES_ESTACIONAMENTO: Record<string, { fundo: string; texto: string }> = {
  "13 de maio 1022": { fundo: "#E6E6E6", texto: "#4A4A4A" },
  "13 de maio 409": { fundo: "#BFE1F6", texto: "#1B5E8A" },
  igreja: { fundo: "#FFCFC9", texto: "#A83B33" },
  "luiz barreto": { fundo: "#C6DBE1", texto: "#2F5E6E" },
  produtora: { fundo: "#FFE5A0", texto: "#8A6D1D" },
};

function coresEstacionamento(nome: string): { fundo: string; texto: string } {
  return (
    CORES_ESTACIONAMENTO[normalizar(nome)] ?? { fundo: "#E0D9C8", texto: "#6B6960" }
  );
}

function CabecalhoOrdenavel({
  titulo,
  coluna,
  ordenacao,
  aoOrdenar,
}: {
  titulo: string;
  coluna: ColunaOrdenacao;
  ordenacao: Ordenacao | null;
  aoOrdenar: (coluna: ColunaOrdenacao) => void;
}) {
  const ativa = ordenacao?.coluna === coluna;
  return (
    <th className="text-left py-2 px-3 font-medium text-ardesia">
      <button
        type="button"
        onClick={() => aoOrdenar(coluna)}
        className="inline-flex items-center gap-1 hover:text-carbone cursor-pointer"
      >
        {titulo}
        {ativa && (
          <span className="text-xs text-ardesia">
            {ordenacao!.direcao === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}

export function Veiculos() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens, carregando, erro } = useVeiculos();
  const { itens: estacionamentos } = useEstacionamentos();
  const mapaEstacionamento = useMemo(
    () => new Map(estacionamentos.map((e) => [e.id, e.nome])),
    [estacionamentos]
  );

  const { edicao } = useEdicaoAtiva();
  const { itens: equipes } = useEquipes(edicao?.id);
  const { itens: participacoes } = useParticipacoes(edicao?.id);
  const [termo, setTermo] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);

  function alternarOrdenacao(coluna: ColunaOrdenacao) {
    setOrdenacao((prev) =>
      prev?.coluna === coluna
        ? { coluna, direcao: prev.direcao === "asc" ? "desc" : "asc" }
        : { coluna, direcao: "asc" }
    );
  }

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
    for (const v of itens) {
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
  }, [itens, equipesPorPessoa]);

  const podeCriar = adminPode(sessao);

  const veiculosFiltrados = useMemo(() => {
    const t = normalizar(termo);
    const base = t
      ? itens.filter((v) => {
          if (normalizar(v.placa ?? "").includes(t)) return true;
          if (normalizar(v.fabricante ?? "").includes(t)) return true;
          if (normalizar(v.modelo ?? "").includes(t)) return true;
          if (normalizar(v.cor ?? "").includes(t)) return true;
          const estacionamento = v.estacionamentoId
            ? mapaEstacionamento.get(v.estacionamentoId) ?? ""
            : "";
          if (normalizar(estacionamento).includes(t)) return true;
          if (normalizar(v.observacao ?? "").includes(t)) return true;
          if (["sim", "impresso"].includes(t) && v.crachaCarroImpresso) return true;
          if (t === "nao" && !v.crachaCarroImpresso) return true;
          if (
            v.pessoas.some(
              (p) =>
                normalizar(p.nome ?? "").includes(t) ||
                String(p.cracha ?? "").includes(t)
            )
          )
            return true;
          return (equipesPorVeiculo.get(v.id) ?? []).some((nome) =>
            normalizar(nome ?? "").includes(t)
          );
        })
      : itens;

    if (!ordenacao) return base;
    const lista = [...base];
    const { coluna, direcao } = ordenacao;
    lista.sort((a, b) => {
      const va = valorOrdenacao(
        a,
        coluna,
        mapaEstacionamento,
        equipesPorVeiculo.get(a.id) ?? []
      );
      const vb = valorOrdenacao(
        b,
        coluna,
        mapaEstacionamento,
        equipesPorVeiculo.get(b.id) ?? []
      );
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      const cmp = va.localeCompare(vb, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
      return direcao === "asc" ? cmp : -cmp;
    });
    return lista;
  }, [itens, termo, mapaEstacionamento, equipesPorVeiculo, ordenacao]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Festa</div>
          <h2 className="mt-1">Veiculos</h2>
          <p className="text-ardesia text-sm">
            {carregando ? "Carregando..." : `${veiculosFiltrados.length} de ${itens.length} registros`}
          </p>
        </div>
        {podeCriar && (
          <Link
            to="/veiculos/novo"
            className="btn btn-primario"
            aria-label="Novo veiculo"
            title="Novo veiculo"
          >
            <Icone nome="mais" />
          </Link>
        )}
      </header>

      <div className="card">
        <div className="card-corpo">
          <input
            className="input"
            placeholder="Buscar por placa, fabricante, modelo, cor, estacionamento, pessoa, equipe ou observacao..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>
      </div>

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      {!carregando && veiculosFiltrados.length === 0 && !erro && (
        <div className="card">
          <div className="card-corpo text-center text-ardesia">
            {termo.trim()
              ? "Nenhum veiculo encontrado para esta busca."
              : "Nenhum veiculo cadastrado."}
          </div>
        </div>
      )}

      {veiculosFiltrados.length > 0 && (
        <div className="card">
          <div className="card-corpo overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cinza-200">
                  <CabecalhoOrdenavel titulo="Placa" coluna="placa" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                  <CabecalhoOrdenavel titulo="Estacionamento" coluna="estacionamento" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                  <CabecalhoOrdenavel titulo="Pessoas" coluna="pessoas" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                  <CabecalhoOrdenavel titulo="Equipes" coluna="equipes" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                  <CabecalhoOrdenavel titulo="Fabricante" coluna="fabricante" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                  <CabecalhoOrdenavel titulo="Modelo" coluna="modelo" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                  <CabecalhoOrdenavel titulo="Cor" coluna="cor" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                  <CabecalhoOrdenavel titulo="Observacao" coluna="observacao" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                  <CabecalhoOrdenavel titulo="Impresso" coluna="impresso" ordenacao={ordenacao} aoOrdenar={alternarOrdenacao} />
                </tr>
              </thead>
              <tbody>
                {veiculosFiltrados.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-cinza-100 hover:bg-cinza-50 cursor-pointer"
                    onClick={() => navigate(`/veiculos/${v.id}`)}
                  >
                    <td className="py-2 px-3 font-mono font-medium">{v.placa}</td>
                    <td className="py-2 px-3">
                      {v.estacionamentoId ? (
                        (() => {
                          const nome = mapaEstacionamento.get(v.estacionamentoId);
                          if (!nome) {
                            return (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-verde/10 text-verde-escuro">
                                Vinculado
                              </span>
                            );
                          }
                          const cores = coresEstacionamento(nome);
                          return (
                            <span
                              style={{ backgroundColor: cores.fundo, color: cores.texto }}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            >
                              {nome}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-ardesia">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {v.pessoas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {v.pessoas.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-azul/10 text-azul-escuro"
                            >
                              {p.nome}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ardesia">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {(equipesPorVeiculo.get(v.id) ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {equipesPorVeiculo.get(v.id)!.map((nome) => (
                            <span
                              key={nome}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ouro-suave text-ouro-texto"
                            >
                              {nome}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ardesia">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">{v.fabricante}</td>
                    <td className="py-2 px-3">{v.modelo}</td>
                    <td className="py-2 px-3">{v.cor}</td>
                    <td className="py-2 px-3 max-w-[200px]">
                      {v.observacao ? (
                        <span className="block truncate" title={v.observacao}>
                          {v.observacao}
                        </span>
                      ) : (
                        <span className="text-ardesia">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {v.crachaCarroImpresso ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-verde/10 text-verde-escuro">
                          Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cinza-200 text-ardesia">
                          Nao
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
