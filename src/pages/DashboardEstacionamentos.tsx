import { useEffect, useState } from "react";
import { useDashboardEstacionamentos } from "../lib/hooks";
import { conectarDashboardSSE } from "../lib/dashboard";
import type {
  CheckinResumo,
  EstacionamentoComOcupacao,
  StatusConexao,
} from "../lib/dashboard";
import { useSessao } from "../lib/sessao";
import { CardOcupacao } from "../components/CardOcupacao";
import { ListaCheckinsRecentes } from "../components/ListaCheckinsRecentes";
import { NotificacaoCheckin } from "../components/NotificacaoCheckin";

const STATUS_ROTULO: Record<StatusConexao, string> = {
  conectado: "Conectado",
  desconectado: "Atualizacao pausada",
  reconectando: "Reconectando...",
};

const STATUS_COR: Record<StatusConexao, string> = {
  conectado: "bg-verde",
  desconectado: "bg-vermelho",
  reconectando: "bg-ouro",
};

export function DashboardEstacionamentos() {
  const { dados, carregando, erro } = useDashboardEstacionamentos();
  const { sessao } = useSessao();

  const [estacionamentos, setEstacionamentos] = useState<
    EstacionamentoComOcupacao[]
  >([]);
  const [ultimosCheckins, setUltimosCheckins] = useState<CheckinResumo[]>([]);
  const [statusConexao, setStatusConexao] =
    useState<StatusConexao>("desconectado");
  const [novosCheckins, setNovosCheckins] = useState<CheckinResumo[]>([]);

  useEffect(() => {
    if (dados) {
      setEstacionamentos(
        [...dados.estacionamentos].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR"),
        ),
      );
      setUltimosCheckins(dados.ultimosCheckins);
    }
  }, [dados]);

  useEffect(() => {
    if (!sessao) return;

    const limpar = conectarDashboardSSE(
      (checkin) => {
        setEstacionamentos((prev) =>
          prev.map((e) =>
            e.id === checkin.estacionamentoId
              ? {
                  ...e,
                  checkinsHoje: e.checkinsHoje + 1,
                  ocupacaoPercentual:
                    e.vagasContratadas > 0
                      ? Math.round(
                          ((e.checkinsHoje + 1) / e.vagasContratadas) * 100,
                        )
                      : null,
                }
              : e,
          ),
        );

        setUltimosCheckins((prev) => {
          const atualizados = [checkin, ...prev].slice(0, 20);
          return atualizados;
        });

        setNovosCheckins((prev) => [...prev, checkin]);
      },
      (status) => setStatusConexao(status),
    );

    return limpar;
  }, [sessao]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-ardesia text-lg">Carregando dashboard...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-vermelho-escuro text-lg">Erro ao carregar dados: {erro}</p>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-6 py-8 space-y-8">
      <NotificacaoCheckin fila={novosCheckins} />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display text-verde-escuro">
          Estacionamentos - {new Date().toLocaleDateString("pt-BR")}
        </h1>

        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COR[statusConexao]}`}
          />
          <span className="text-ardesia">{STATUS_ROTULO[statusConexao]}</span>
        </div>
      </div>

      {estacionamentos.length === 0 ? (
        <div className="card">
          <div className="card-corpo text-center py-12">
            <p className="text-ardesia text-lg">
              Nenhum estacionamento cadastrado.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {estacionamentos.map((e) => (
            <CardOcupacao key={e.id} estacionamento={e} />
          ))}
        </div>
      )}

      <section>
        <h2 className="text-2xl font-display text-carbone mb-4">
          Ultimos check-ins
        </h2>
        <div className="card">
          <div className="card-corpo">
            <ListaCheckinsRecentes
              checkins={ultimosCheckins}
              carregando={carregando}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
