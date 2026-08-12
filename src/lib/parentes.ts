import { api } from "./api";
import { queryClient } from "./queryClient";
import { Parentesco } from "./tipos";

function chaveParentes(pessoaId: string): string[] {
  return ["pessoas", pessoaId, "parentes"];
}

// Invalida o cache dos dois lados do vínculo (o próprio e o do parente).
function invalidarParentes(pessoaId: string, parenteId?: string) {
  queryClient.invalidateQueries({ queryKey: chaveParentes(pessoaId) });
  if (parenteId) queryClient.invalidateQueries({ queryKey: chaveParentes(parenteId) });
}

export async function listarParentes(pessoaId: string): Promise<Parentesco[]> {
  return api.get<Parentesco[]>(`/api/pessoas/${pessoaId}/parentes`);
}

export async function adicionarParente(
  pessoaId: string,
  parenteId: string,
  parentesco: string
): Promise<void> {
  await api.post(`/api/pessoas/${pessoaId}/parentes`, { parenteId, parentesco });
  invalidarParentes(pessoaId, parenteId);
}

export async function removerParente(
  pessoaId: string,
  parenteId: string
): Promise<void> {
  await api.delete(`/api/pessoas/${pessoaId}/parentes/${parenteId}`);
  invalidarParentes(pessoaId, parenteId);
}
