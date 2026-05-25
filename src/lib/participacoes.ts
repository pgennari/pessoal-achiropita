import { api } from "./api";
import { queryClient } from "./queryClient";
import { Funcao, Participacao } from "./tipos";
import { Sessao } from "./sessao";

export class ErroAlocacao extends Error {}

export function participacaoDeSnap(id: string, data: Record<string, unknown>): Participacao {
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    barracaId: (data.barracaId as string) ?? "",
    pessoaId: (data.pessoaId as string) ?? "",
    funcao: (data.funcao as Funcao) ?? "Equipista",
    criadoEm: (data.criadoEm as string) || "",
    atualizadoEm: (data.atualizadoEm as string) || "",
  };
}

function invalidarParticipacoes() {
  queryClient.invalidateQueries({ queryKey: ["participacoes"] });
}

export async function alocar(
  _sessao: Sessao,
  args: {
    edicaoId: string;
    barracaId: string;
    pessoaId: string;
    funcao: Funcao;
    pessoaNome: string;
    barracaNome: string;
  }
): Promise<string> {
  const part = await api.post<Participacao>("/api/participacoes", args);
  invalidarParticipacoes();
  return part.id as string;
}

export async function moverDeBarraca(
  _sessao: Sessao,
  participacao: Participacao,
  novoBarracaId: string,
  novaFuncao: Funcao,
  pessoaNome: string,
  barracaOrigemNome: string,
  barracaDestinoNome: string
): Promise<void> {
  await api.put(`/api/participacoes/${participacao.id}`, {
    barracaId: novoBarracaId,
    funcao: novaFuncao,
    pessoaNome,
    barracaOrigemNome,
    barracaDestinoNome,
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
    barracaId: participacao.barracaId,
    funcao: novaFuncao,
  });
  invalidarParticipacoes();
}

export async function desalocar(
  _sessao: Sessao,
  participacao: Participacao,
  _pessoaNome: string,
  _barracaNome: string
): Promise<void> {
  await api.delete(`/api/participacoes/${participacao.id}`);
  invalidarParticipacoes();
}
