import { api } from "./api";
import { queryClient } from "./queryClient";
import { Formacao, TipoPresenca } from "./tipos";
import { Sessao } from "./sessao";

export class ErroFormacao extends Error { }

export function idFormacao(edicaoId: string, pessoaId: string): string {
  return `${edicaoId}__${pessoaId}`;
}

export function formacaoDeSnap(id: string, data: Record<string, unknown>): Formacao {
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    pessoaId: (data.pessoaId as string) ?? "",
    turmaId: (data.turmaId as string) || undefined,
    presencaTipo: (data.presencaTipo as TipoPresenca) ?? "manual",
    presencaEm: (data.presencaEm as string) || "",
    registradoPorUid: (data.registradoPorUid as string) ?? "",
    registradoPorNome: (data.registradoPorNome as string) ?? "",
    justificativa: (data.justificativa as string) || undefined,
    dadosValidados: !!data.dadosValidados,
    validadoEm: (data.validadoEm as string) || undefined,
  };
}

function invalidarFormacoes() {
  queryClient.invalidateQueries({ queryKey: ["formacoes"] });
}

export async function marcarPresencaManual(
  _sessao: Sessao,
  args: {
    edicaoId: string;
    pessoaId: string;
    pessoaNome: string;
    cracha: number;
    turmaId?: string;
    justificativa: string;
  }
): Promise<void> {
  if (!args.justificativa.trim() || args.justificativa.trim().length < 3) {
    throw new ErroFormacao("Justificativa é obrigatória ao marcar presença manualmente.");
  }
  await api.post("/api/formacoes", {
    edicaoId: args.edicaoId,
    pessoaId: args.pessoaId,
    turmaId: args.turmaId ?? null,
    justificativa: args.justificativa.trim(),
    pessoaNome: args.pessoaNome,
    cracha: args.cracha,
  });
  invalidarFormacoes();
}

export async function confirmarDadosManual(
  _sessao: Sessao,
  formacao: Formacao,
  pessoaNome: string,
  cracha: number
): Promise<void> {
  await api.put(`/api/formacoes/${formacao.id}/confirmar`, { pessoaNome, cracha });
  invalidarFormacoes();
}

export async function removerFormacao(
  _sessao: Sessao,
  formacao: Formacao,
  pessoaNome: string,
  cracha: number
): Promise<void> {
  await api.delete(`/api/formacoes/${formacao.id}`, { pessoaNome, cracha });
  invalidarFormacoes();
}
