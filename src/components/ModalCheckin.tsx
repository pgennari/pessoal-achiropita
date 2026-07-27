import { useState } from "react";
import { DadosCheckin, registrarCheckin } from "../lib/checkin";

interface Props {
  token: string;
  veiculoId: string;
  placa: string;
  modelo: string;
  cor: string;
  estacionamentoNome: string;
  onFechar: () => void;
  onConfirmado: (checkin: DadosCheckin["checkin"]) => void;
}

export function ModalCheckin({
  token,
  veiculoId,
  placa,
  modelo,
  cor,
  estacionamentoNome,
  onFechar,
  onConfirmado,
}: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleConfirmar() {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await registrarCheckin(token, veiculoId);
      onConfirmado(resultado.checkin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao registrar check-in.";
      setErro(msg);
      setOcupado(false);
    }
  }

  const agora = new Date().toLocaleString("pt-BR");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbone/50">
      <div className="card w-full max-w-md mx-4">
        <div className="card-corpo space-y-4">
          <h3>Confirmar check-in</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ardesia">Data/hora</span>
              <span className="font-mono">{agora}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ardesia">Placa</span>
              <span className="font-mono font-semibold">{placa}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ardesia">Veiculo</span>
              <span>
                {modelo} ({cor})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ardesia">Estacionamento</span>
              <span>{estacionamentoNome}</span>
            </div>
          </div>

          {erro && (
            <div className="rounded-sm bg-vermelho/10 border border-vermelho/30 p-3 text-sm text-vermelho-escuro">
              {erro}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="btn btn-primario flex-1"
              onClick={handleConfirmar}
              disabled={ocupado}
            >
              {ocupado ? "Confirmando..." : "Confirmar"}
            </button>
            <button
              type="button"
              className="btn btn-secundario flex-1"
              onClick={onFechar}
              disabled={ocupado}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
