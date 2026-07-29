import { auth } from "./firebase";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export interface EstacionamentoComOcupacao {
  id: string;
  nome: string;
  endereco: string;
  vagasContratadas: number;
  checkinsHoje: number;
  ocupacaoPercentual: number | null;
}

export interface CheckinResumo {
  id: string;
  timestamp: string;
  pessoaNome: string;
  placa: string;
  modelo: string;
  cor: string;
  estacionamentoId: string;
  estacionamentoNome: string;
}

export interface DashboardInicial {
  estacionamentos: EstacionamentoComOcupacao[];
  ultimosCheckins: CheckinResumo[];
  timestamps: {
    geradoEm: string;
    dataReferencia: string;
  };
}

export type StatusConexao = "conectado" | "desconectado" | "reconectando";

export function conectarDashboardSSE(
  onCheckin: (dados: CheckinResumo) => void,
  onStatus: (status: StatusConexao) => void
): () => void {
  let eventSource: EventSource | null = null;
  let tentativaReconexao: ReturnType<typeof setTimeout> | null = null;
  let encerrado = false;

  async function conectar() {
    if (encerrado) return;

    try {
      const token = await auth().currentUser?.getIdToken();
      if (!token) {
        onStatus("desconectado");
        agendarReconexao();
        return;
      }

      const url = `${API_BASE}/api/estacionamentos/dashboard/eventos?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        onStatus("conectado");
      };

      eventSource.addEventListener("checkin", (e: MessageEvent) => {
        try {
          const dados = JSON.parse(e.data) as CheckinResumo;
          onCheckin(dados);
        } catch {
          // ignora payload invalido
        }
      });

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        onStatus("reconectando");
        agendarReconexao();
      };
    } catch {
      onStatus("desconectado");
      agendarReconexao();
    }
  }

  function agendarReconexao() {
    if (encerrado) return;
    tentativaReconexao = setTimeout(conectar, 3000);
  }

  conectar();

  return () => {
    encerrado = true;
    if (tentativaReconexao) clearTimeout(tentativaReconexao);
    eventSource?.close();
    eventSource = null;
  };
}
