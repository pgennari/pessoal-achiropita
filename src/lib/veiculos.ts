import { api } from "./api";
import { queryClient } from "./queryClient";
import type { Veiculo, PessoaComVeiculos, VeiculoComPessoas } from "./tipos";

export async function listarVeiculos(): Promise<VeiculoComPessoas[]> {
  return api.get<VeiculoComPessoas[]>("/api/veiculos");
}

export async function buscarVeiculo(id: string): Promise<Veiculo> {
  return api.get<Veiculo>(`/api/veiculos/${id}`);
}

export async function criarVeiculo(dados: {
  fabricante: string;
  modelo: string;
  placa: string;
  cor: string;
}): Promise<Veiculo> {
  return api.post<Veiculo>("/api/veiculos", dados);
}

export async function atualizarVeiculo(
  id: string,
  dados: {
    fabricante: string;
    modelo: string;
    placa: string;
    cor: string;
  }
): Promise<Veiculo> {
  return api.put<Veiculo>(`/api/veiculos/${id}`, dados);
}

export async function excluirVeiculo(id: string): Promise<void> {
  return api.delete(`/api/veiculos/${id}`);
}

export async function listarPessoasVeiculo(veiculoId: string): Promise<PessoaComVeiculos[]> {
  return api.get<PessoaComVeiculos[]>(`/api/veiculos/${veiculoId}/pessoas`);
}

export async function vincularPessoaVeiculo(veiculoId: string, pessoaId: string): Promise<void> {
  return api.post(`/api/veiculos/${veiculoId}/pessoas`, { pessoaId });
}

export async function desvincularPessoaVeiculo(veiculoId: string, pessoaId: string): Promise<void> {
  return api.delete(`/api/veiculos/${veiculoId}/pessoas/${pessoaId}`);
}

export async function listarVeiculosPessoa(pessoaId: string): Promise<Veiculo[]> {
  return api.get<Veiculo[]>(`/api/pessoas/${pessoaId}/veiculos`);
}

export async function vincularVeiculoPessoa(pessoaId: string, veiculoId: string): Promise<void> {
  return api.post(`/api/pessoas/${pessoaId}/veiculos`, { veiculoId });
}

export async function desvincularVeiculoPessoa(pessoaId: string, veiculoId: string): Promise<void> {
  return api.delete(`/api/pessoas/${pessoaId}/veiculos/${veiculoId}`);
}

export async function listarVeiculosEstacionamento(estacionamentoId: string): Promise<VeiculoComPessoas[]> {
  return api.get<VeiculoComPessoas[]>(`/api/estacionamentos/${estacionamentoId}/veiculos`);
}

export async function associarVeiculoEstacionamento(estacionamentoId: string, veiculoId: string): Promise<void> {
  await api.post(`/api/estacionamentos/${estacionamentoId}/veiculos`, { veiculoId });
  await queryClient.invalidateQueries({ queryKey: ["estacionamentos", estacionamentoId, "veiculos"] });
  await queryClient.invalidateQueries({ queryKey: ["estacionamentos", estacionamentoId] });
  await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
}

export async function desassociarVeiculoEstacionamento(estacionamentoId: string, veiculoId: string): Promise<void> {
  await api.delete(`/api/estacionamentos/${estacionamentoId}/veiculos/${veiculoId}`);
  await queryClient.invalidateQueries({ queryKey: ["estacionamentos", estacionamentoId, "veiculos"] });
  await queryClient.invalidateQueries({ queryKey: ["estacionamentos", estacionamentoId] });
  await queryClient.invalidateQueries({ queryKey: ["veiculos"] });
}
