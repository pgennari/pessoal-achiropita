import { api } from "./api";
import { queryClient } from "./queryClient";
import { Funcao, Participacao } from "./tipos";
import { Sessao } from "./sessao";

export class ErroAlocacao extends Error {}

export function participacaoDeSnap(id: string, data: Record<string, unknown>): Participacao {
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    equipeId: (data.equipeId as string) ?? "",
    pessoaId: (data.pessoaId as string) ?? "",
    funcao: (data.funcao as Funcao) ?? "Equipista",
    criadoEm: (data.criadoEm as string) || "",
    atualizadoEm: (data.atualizadoEm as string) || "",
  };
}

function invalidarParticipacoes() {
  queryClient.invalidateQueries({ queryKey: ["participacoes"] });
  // Vagas sao calculadas pelas alocacoes; recarrega as equipes tambem.
  queryClient.invalidateQueries({ queryKey: ["equipes"] });
}

export async function alocar(
  _sessao: Sessao,
  args: {
    edicaoId: string;
    equipeId: string;
    pessoaId: string;
    funcao: Funcao;
    pessoaNome: string;
    equipeNome: string;
  }
): Promise<string> {
  const part = await api.post<Participacao>("/api/participacoes", args);
  invalidarParticipacoes();
  return part.id as string;
}

export async function moverDeEquipe(
  _sessao: Sessao,
  participacao: Participacao,
  novoEquipeId: string,
  novaFuncao: Funcao,
  pessoaNome: string,
  equipeOrigemNome: string,
  equipeDestinoNome: string
): Promise<void> {
  await api.put(`/api/participacoes/${participacao.id}`, {
    equipeId: novoEquipeId,
    funcao: novaFuncao,
    pessoaNome,
    equipeOrigemNome,
    equipeDestinoNome,
  });
  invalidarParticipacoes();
}

export async function trocarFuncao(
  _sessao: Sessao,
  participacao: Participacao,
  novaFuncao: Funcao,
  _pessoaNome: string
): Promise<void> {
  await api.put(`/api/participacoes/${participacao.id}`, {
    equipeId: participacao.equipeId,
    funcao: novaFuncao,
  });
  invalidarParticipacoes();
}

export async function desalocar(
  _sessao: Sessao,
  participacao: Participacao,
  _pessoaNome: string,
  _equipeNome: string
): Promise<void> {
  await api.delete(`/api/participacoes/${participacao.id}`);
  invalidarParticipacoes();
}
