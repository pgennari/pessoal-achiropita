import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useEdicaoAtiva,
  useEquipes,
  useEstacionamentos,
  useParticipacoes,
  useVeiculos,
} from "../lib/hooks";
import { useSessao } from "../lib/sessao";
import { normalizar } from "../lib/utilsDominio";

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

  const podeCriar = sessao?.perfil === "ADM" || sessao?.perfil === "ORG";

  const veiculosFiltrados = useMemo(() => {
    const t = normalizar(termo);
    if (!t) return itens;
    return itens.filter((v) => {
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
    });
  }, [itens, termo, mapaEstacionamento, equipesPorVeiculo]);

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
          <Link to="/veiculos/novo" className="btn btn-primario">
            Novo veiculo
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
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Placa</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Fabricante</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Modelo</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Cor</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Estacionamento</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Pessoas</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Equipes</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Observacao</th>
                  <th className="text-left py-2 px-3 font-medium text-ardesia">Impresso</th>
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
                    <td className="py-2 px-3">{v.fabricante}</td>
                    <td className="py-2 px-3">{v.modelo}</td>
                    <td className="py-2 px-3">{v.cor}</td>
                    <td className="py-2 px-3">
                      {v.estacionamentoId ? (
                        mapaEstacionamento.get(v.estacionamentoId) ?? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-verde/10 text-verde-escuro">
                            Vinculado
                          </span>
                        )
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
