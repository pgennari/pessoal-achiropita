import { api } from "./api";
import { queryClient } from "./queryClient";
import { Sessao } from "./sessao";
import { Estacionamento } from "./tipos";

export interface DadosEstacionamentoForm {
  nome: string;
  endereco: string;
  vagasContratadas: string;
  vagasDistribuidas: string;
  dentroPerimetro: boolean;
  horarios: string;
}

export class ErroValidacao extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, mensagem = "Dados invalidos.") {
    super(mensagem);
    this.campos = campos;
  }
}

function validar(dados: DadosEstacionamentoForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!dados.nome.trim()) erros.nome = "Nome e obrigatorio.";
  if (!dados.endereco.trim()) erros.endereco = "Endereco e obrigatorio.";

  const vContratadasStr = String(dados.vagasContratadas ?? "").trim();
  if (!vContratadasStr) {
    erros.vagasContratadas = "Quantidade de vagas contratadas e obrigatoria.";
  } else if (!/^\d+$/.test(vContratadasStr)) {
    erros.vagasContratadas = "Apenas numeros sao permitidos.";
  }

  const vDistribuidasStr = String(dados.vagasDistribuidas ?? "").trim();
  if (!vDistribuidasStr) {
    erros.vagasDistribuidas = "Quantidade de vagas distribuidas e obrigatoria.";
  } else if (!/^\d+$/.test(vDistribuidasStr)) {
    erros.vagasDistribuidas = "Apenas numeros sao permitidos.";
  }

  if (!dados.horarios.trim()) erros.horarios = "Horarios sao obrigatorios.";
  return erros;
}

export async function criarEstacionamento(
  _sessao: Sessao,
  dados: DadosEstacionamentoForm
): Promise<string> {
  const erros = validar(dados);
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros);

  const estacionamento = await api.post<Estacionamento>("/api/estacionamentos", {
    nome: dados.nome.trim(),
    endereco: dados.endereco.trim(),
    vagasContratadas: parseInt(dados.vagasContratadas, 10),
    vagasDistribuidas: parseInt(dados.vagasDistribuidas, 10),
    dentroPerimetro: dados.dentroPerimetro,
    horarios: dados.horarios.trim(),
  });

  await queryClient.invalidateQueries({ queryKey: ["estacionamentos"] });
  return estacionamento.id;
}

export async function atualizarEstacionamento(
  _sessao: Sessao,
  id: string,
  dados: DadosEstacionamentoForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros);

  await api.put(`/api/estacionamentos/${id}`, {
    nome: dados.nome.trim(),
    endereco: dados.endereco.trim(),
    vagasContratadas: parseInt(dados.vagasContratadas, 10),
    vagasDistribuidas: parseInt(dados.vagasDistribuidas, 10),
    dentroPerimetro: dados.dentroPerimetro,
    horarios: dados.horarios.trim(),
  });

  await queryClient.invalidateQueries({ queryKey: ["estacionamentos"] });
}

export async function excluirEstacionamento(
  _sessao: Sessao,
  id: string
): Promise<void> {
  await api.delete(`/api/estacionamentos/${id}`);
  await queryClient.invalidateQueries({ queryKey: ["estacionamentos"] });
}
