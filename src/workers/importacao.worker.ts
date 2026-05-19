import {
  MensagemWorkerEntrada,
  MensagemWorkerSaida,
  processarLinhas,
} from "../lib/importacaoUtils";

self.onmessage = (ev: MessageEvent<MensagemWorkerEntrada>) => {
  const { tipo, linhasXlsx, colunas, mapeamento } = ev.data;
  if (tipo !== "processar") return;

  try {
    self.postMessage({ tipo: "progresso", porcentagem: 0 } satisfies MensagemWorkerSaida);

    const linhasProcessadas = processarLinhas(
      linhasXlsx,
      colunas,
      mapeamento,
      (porcentagem) => {
        self.postMessage({ tipo: "progresso", porcentagem } satisfies MensagemWorkerSaida);
      }
    );

    self.postMessage({ tipo: "resultado", linhasProcessadas } satisfies MensagemWorkerSaida);
  } catch (e) {
    self.postMessage({
      tipo: "erro",
      mensagem: e instanceof Error ? e.message : "Erro desconhecido no worker.",
    } satisfies MensagemWorkerSaida);
  }
};
