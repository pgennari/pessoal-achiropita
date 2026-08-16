// ============================================================================
// CONTROLE DE PERMISSAO
// Acesso: vaga.lista. Criar: vaga.incluir.
// ============================================================================
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useVagas } from "../lib/hooks";
import { useSessao, temPermissao } from "../lib/sessao";
import { normalizar } from "../lib/utilsDominio";
import { Icone } from "../components/Icone";

function placaComHifen(placa: string) {
  const limpa = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (limpa.length <= 3) return limpa;
  return `${limpa.slice(0, 3)}-${limpa.slice(3)}`;
}

function normalizarPlaca(texto: string) {
  return normalizar(texto).replace(/[^a-z0-9]/g, "");
}

export function Vagas() {
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const { itens, carregando, erro } = useVagas();
  const [termo, setTermo] = useState("");

  const ordenadas = useMemo(() => {
    const t = normalizar(termo);
    const tp = normalizarPlaca(termo);
    return [...itens]
      .sort((a, b) => a.identificacao.localeCompare(b.identificacao, "pt-BR"))
      .filter((v) => {
        if (!t) return true;
        if (normalizar(v.identificacao).includes(t)) return true;
        if (normalizar(v.estacionamentoNome ?? "").includes(t)) return true;
        if (v.pessoas.some((p) => normalizar(p.nome).includes(t))) return true;
        if (v.veiculos.some((ve) => normalizarPlaca(ve.placa).includes(tp))) return true;
        return false;
      });
  }, [itens, termo]);

  const podeCriar = temPermissao(sessao, "vaga.incluir");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Gestao de Estacionamento</div>
          <h2 className="mt-1">Vagas</h2>
          <p className="text-ardesia text-sm">
            {carregando ? "Carregando..." : `${itens.length} registros`}
          </p>
        </div>
        {podeCriar && (
          <Link
            to="/vagas/nova"
            className="btn btn-primario"
            aria-label="Nova vaga"
            title="Nova vaga"
          >
            <Icone nome="mais" />
          </Link>
        )}
      </header>

      <div className="card">
        <div className="card-corpo">
          <input
            className="input"
            placeholder="Buscar por nome da pessoa, placa do veículo ou estacionamento..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            aria-label="Buscar vagas"
          />
        </div>
      </div>

      {!carregando && ordenadas.length === 0 && !erro && (
        <div className="card">
          <div className="card-corpo text-center text-ardesia">
            {termo.trim()
              ? "Nenhuma vaga encontrada para esta busca."
              : "Nenhuma vaga cadastrada."}
          </div>
        </div>
      )}

      {erro && (
        <div className="card border-vermelho/40">
          <div className="card-corpo text-vermelho-escuro">{erro}</div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ordenadas.map((v) => (
          <div
            key={v.id}
            className="rounded-[16px] border border-pietra bg-bianco p-4 cursor-pointer hover:border-verde/50 hover:shadow-suave transition-all"
            onClick={() => navigate(`/vagas/${v.id}`)}
          >
            <header className="flex items-center justify-between gap-3">
              <Link
                to={`/vagas/${v.id}`}
                className="font-semibold text-carbone hover:text-verde no-underline hover:underline min-w-0 truncate"
                onClick={(ev) => ev.stopPropagation()}
              >
                {v.identificacao}
              </Link>
              {v.estacionamentoNome ? (
                <span className="badge badge-verde shrink-0">
                  {v.estacionamentoNome}
                </span>
              ) : (
                <span className="badge badge-cinza shrink-0">
                  sem estacionamento
                </span>
              )}
            </header>

            {v.pessoas.length > 0 && (
              <div className="text-sm text-carbone mt-3">
                {v.pessoas.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    {p.nome}
                  </span>
                ))}
              </div>
            )}

            <div className="border-b border-pietra-clara my-3" />

            <div>
              <div className="text-ardesia font-semibold uppercase tracking-widest mb-2 text-[0.7rem]">
                Veículos
              </div>
              {v.veiculos.length > 0 ? (
                <div className="space-y-2">
                  {v.veiculos.map((ve) => (
                    <div
                      key={ve.id}
                      className="flex items-center gap-3 rounded-[10px] border border-pietra-clara bg-crema px-3 py-2"
                    >
                      <Icone
                        nome="carro"
                        tamanho={18}
                        className="text-ardesia shrink-0"
                      />
                      <span className="font-mono font-semibold text-carbone">
                        {placaComHifen(ve.placa)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-ardesia">Sem veículos</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
