import { api, apiPublica } from "./api";
import { queryClient } from "./queryClient";
import { Avaliacao, LinkAvaliacao } from "./tipos";

// ─── Rotas internas (requerem autenticação ADM/ORG) ────────────────────────

export async function gerarLinkAvaliacao(
  edicaoId: string,
): Promise<LinkAvaliacao> {
  const data = await api.post<LinkAvaliacao>("/api/avaliacao/links", {
    edicaoId,
  });
  queryClient.invalidateQueries({ queryKey: ["avaliacaoLink", edicaoId] });
  return data;
}

export async function revogarLinkAvaliacao(token: string): Promise<void> {
  await api.put(`/api/avaliacao/links/${token}/revogar`);
  queryClient.invalidateQueries({ queryKey: ["avaliacaoLink"] });
}

export async function buscarLinkAvaliacaoAtivo(
  edicaoId: string,
): Promise<LinkAvaliacao | null> {
  try {
    return await api.get<LinkAvaliacao>(`/api/avaliacao/links/${edicaoId}`);
  } catch {
    return null;
  }
}

export async function listarAvaliacoes(
  edicaoId: string,
  equipeId?: string,
  status?: string,
): Promise<Avaliacao[]> {
  const params = new URLSearchParams({ edicaoId });
  if (equipeId) params.set("equipeId", equipeId);
  if (status) params.set("status", status);
  return api.get<Avaliacao[]>(`/api/avaliacoes?${params.toString()}`);
}

export async function buscarAvaliacao(id: string): Promise<Avaliacao> {
  return api.get<Avaliacao>(`/api/avaliacoes/${id}`);
}

export async function listarAvaliacoesPessoa(
  pessoaId: string,
): Promise<Avaliacao[]> {
  return api.get<Avaliacao[]>(`/api/avaliacoes/pessoa/${pessoaId}`);
}

// ─── Rotas públicas (anonimas) ─────────────────────────────────────────────

export async function verificarLinkAvaliacao(
  token: string,
): Promise<{ valido: boolean; edicaoId?: string; edicaoNumero?: number }> {
  return apiPublica<{
    valido: boolean;
    edicaoId?: string;
    edicaoNumero?: number;
  }>("GET", `/api/publico/avaliacao/${token}`);
}

export async function identificarCoordenador(
  token: string,
  cracha: number,
): Promise<{
  nome?: string;
  equipeId?: string;
  equipeNome?: string;
  sessaoToken?: string;
  erro?: string;
}> {
  return apiPublica<{
    nome?: string;
    equipeId?: string;
    equipeNome?: string;
    sessaoToken?: string;
    erro?: string;
  }>("POST", "/api/publico/avaliacao/coordenador", { token, cracha });
}

export async function listarEquipistasAvaliacao(
  sessaoToken: string,
): Promise<
  {
    pessoaId: string;
    nome: string;
    cracha: string | null;
    avaliacaoId: string | null;
    statusAvaliacao: string | null;
    criterios: Record<string, string | null> | null;
    aptoCoordenar: boolean | null;
    comentarios: string | null;
  }[]
> {
  return api.get("/api/publico/avaliacao/equipistas", sessaoToken);
}

export async function salvarAvaliacaoPublica(
  sessaoToken: string,
  dados: {
    pessoaId: string;
    criterios: Record<string, string | null>;
    aptoCoordenar: boolean | null;
    comentarios: string | null;
    finalizar: boolean;
  },
): Promise<{ id: string; status: string; atualizadoEm: string }> {
  return api.post("/api/publico/avaliacao", dados, sessaoToken);
}
