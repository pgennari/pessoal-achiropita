import { apiPublica } from "./api";

export interface DadosEstacionamentoPublico {
  estacionamentoId: string;
  nome: string;
  endereco: string;
}

export interface ResultadoBusca {
  pessoaId: string;
  pessoaNome: string;
  carroId: string;
  placa: string;
  modelo: string;
  cor: string;
  jaPossuiCheckin: boolean;
}

export interface DadosCheckin {
  sucesso: boolean;
  mensagem: string;
  checkin: {
    id: string;
    timestamp: string;
    pessoaNome: string;
    placa: string;
    modelo: string;
    cor: string;
    estacionamentoNome: string;
  };
}

export async function buscarEstacionamentoPublico(
  token: string
): Promise<DadosEstacionamentoPublico> {
  return apiPublica<DadosEstacionamentoPublico>(
    "GET",
    `/api/publico/checkin/${token}`
  );
}

export async function buscarPorPlaca(
  token: string,
  placa: string
): Promise<{ resultados: ResultadoBusca[] }> {
  return apiPublica<{ resultados: ResultadoBusca[] }>(
    "GET",
    `/api/publico/checkin/${token}/buscar?placa=${encodeURIComponent(placa)}`
  );
}

export async function registrarCheckin(
  token: string,
  pessoaId: string,
  carroId: string
): Promise<DadosCheckin> {
  return apiPublica<DadosCheckin>("POST", `/api/publico/checkin/${token}`, {
    pessoaId,
    carroId,
  });
}
