import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { useCheckinPublico } from "../lib/hooks";
import { buscarPorPlaca, ResultadoBusca, DadosCheckin } from "../lib/checkin";
import { ModalCheckin } from "../components/ModalCheckin";

export function CheckinPublico() {
  const { token } = useParams<{ token: string }>();
  const { estacionamento, carregando, erro } = useCheckinPublico(token);

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
    setResultados((prev) =>
      prev.map((r) =>
        r.carroId === checkin.id
          ? { ...r, jaPossuiCheckin: true }
          : r
      )
    );
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
            <div className="card-corpo text-sm text-vermelho-escuro">
              {erroBusca}
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
              Nenhuma pessoa encontrada para esta placa neste estacionamento.
            </div>
          </div>
        )}

        {resultados.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-ardesia">Resultados</h4>
            {resultados.map((r, i) => (
              <div key={`${r.pessoaId}-${r.carroId}-${i}`} className="card">
                <div className="card-corpo flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-carbone">
                      {r.pessoaNome}
                    </div>
                    <div className="text-sm text-ardesia">
                      <span className="font-mono font-semibold">{r.placa}</span>
                      {" - "}
                      {r.modelo} ({r.cor})
                    </div>
                  </div>
                  {r.jaPossuiCheckin ? (
                    <span className="badge badge-cinza">Ja registrado</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primario btn-pequeno"
                      onClick={() => handleAbrirModal(r)}
                    >
                      Check-in
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAberto && selecionado && token && (
        <ModalCheckin
          token={token}
          pessoaId={selecionado.pessoaId}
          pessoaNome={selecionado.pessoaNome}
          carroId={selecionado.carroId}
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
