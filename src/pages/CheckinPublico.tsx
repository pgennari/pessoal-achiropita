import { FormEvent, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCheckinPublico, useHistoricoPublico } from "../lib/hooks";
import { buscarPorPlaca, ResultadoBusca, DadosCheckin } from "../lib/checkin";
import { ModalCheckin } from "../components/ModalCheckin";
import { VeiculoCard } from "../components/VeiculoCard";
import { HistoricoCheckinPublico } from "../components/HistoricoCheckinPublico";

function renderizarErroFormatado(texto: string) {
  return texto.split("\n").map((linha, i) => (
    <span key={i} className="block">
      {linha.split(/\*(.*?)\*/).map((parte, j) =>
        j % 2 === 1 ? (
          <strong key={j} className="font-bold text-vermelho-escuro">
            {parte}
          </strong>
        ) : (
          <span key={j}>{parte}</span>
        )
      )}
    </span>
  ));
}

export function CheckinPublico() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const { estacionamento, carregando, erro } = useCheckinPublico(token);
  const { historico, carregando: carregandoHistorico } = useHistoricoPublico(token);

  const placaRef = useRef<HTMLInputElement>(null);

  const [placa, setPlaca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscou, setBuscou] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<ResultadoBusca | null>(null);
  const [sucesso, setSucesso] = useState<DadosCheckin["checkin"] | null>(null);

  async function handleBuscar(ev: FormEvent) {
    ev.preventDefault();
    if (!token || !placa.trim()) return;
    setBuscando(true);
    setErroBusca(null);
    setResultados([]);
    setBuscou(false);
    try {
      const r = await buscarPorPlaca(token, placa.trim());
      setResultados(r.resultados);
      setBuscou(true);
    } catch (e) {
      setErroBusca(
        e instanceof Error ? e.message : "Falha ao buscar placa."
      );
      setBuscou(true);
    } finally {
      setBuscando(false);
    }
  }

  function handleAbrirModal(r: ResultadoBusca) {
    setSelecionado(r);
    setModalAberto(true);
  }

  function handleConfirmado(checkin: DadosCheckin["checkin"]) {
    setModalAberto(false);
    setSelecionado(null);
    setSucesso(checkin);
    setResultados([]);
    setBuscou(false);
    setPlaca("");
    queryClient.invalidateQueries({ queryKey: ["checkin", "historico", token] });
    setTimeout(() => placaRef.current?.focus(), 0);
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-crema">
        <p className="text-ardesia">Carregando...</p>
      </div>
    );
  }

  if (erro || !estacionamento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-crema">
        <div className="card w-full max-w-md mx-4">
          <div className="card-corpo text-center space-y-3">
            <h3>Link invalido</h3>
            <p className="text-ardesia text-sm">
              {erro ?? "Estacionamento nao encontrado. Verifique o link."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-crema">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <header className="text-center space-y-3">
          <img
            src="/logo-achiropita.png"
            alt="Logo Festa Nossa Senhora Achiropita"
            className="mx-auto h-20 w-auto"
          />
          <div className="eyebrow">Check-in</div>
          <h2 className="mt-1">{estacionamento.nome}</h2>
          <p className="text-ardesia text-sm">{estacionamento.endereco}</p>
        </header>

        <form onSubmit={handleBuscar} className="card">
          <div className="card-corpo space-y-3">
            <label className="input-label" htmlFor="placa">
              Buscar por placa
            </label>
            <div className="flex gap-2">
              <input
                id="placa"
                ref={placaRef}
                className="input flex-1"
                placeholder="ABC-1234"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-primario"
                disabled={buscando || !placa.trim()}
              >
                {buscando ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </div>
        </form>

        {erroBusca && (
          <div className="card border-vermelho/40">
            <div className="card-corpo text-sm text-vermelho-escuro space-y-1">
              {erroBusca.includes("*")
                ? renderizarErroFormatado(erroBusca)
                : erroBusca.split("\n").map((linha, i) =>
                    i === 0 ? (
                      <span key={i}>{linha}</span>
                    ) : (
                      <strong
                        key={i}
                        className="block text-lg font-bold text-vermelho-escuro"
                      >
                        {linha}
                      </strong>
                    )
                  )}
            </div>
          </div>
        )}

        {sucesso && (
          <div className="rounded-sm bg-verde/10 border border-verde/30 p-4 text-sm text-verde-escuro">
            Check-in realizado com sucesso para <strong>{sucesso.pessoaNome}</strong> ({sucesso.placa}).
          </div>
        )}

        {buscou && !erroBusca && resultados.length === 0 && (
          <div className="card">
            <div className="card-corpo text-center text-ardesia text-sm">
              Nenhum veiculo encontrado para esta placa neste estacionamento.
            </div>
          </div>
        )}

        {resultados.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-ardesia">Resultados</h4>
            {resultados.map((r) => (
              <VeiculoCard
                key={r.veiculoId}
                veiculo={r}
                aoCheckin={() => handleAbrirModal(r)}
              />
            ))}
          </div>
        )}

        {token && (
          <HistoricoCheckinPublico
            historico={historico}
            carregando={carregandoHistorico}
          />
        )}
      </div>

      {modalAberto && selecionado && token && (
        <ModalCheckin
          token={token}
          veiculoId={selecionado.veiculoId}
          placa={selecionado.placa}
          modelo={selecionado.modelo}
          cor={selecionado.cor}
          estacionamentoNome={estacionamento.nome}
          onFechar={() => {
            setModalAberto(false);
            setSelecionado(null);
          }}
          onConfirmado={handleConfirmado}
        />
      )}
    </div>
  );
}
