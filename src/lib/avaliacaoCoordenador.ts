import { api, apiPublica } from "./api";
import { queryClient } from "./queryClient";
import {
  AlvoAvaliacaoCoordenador,
  AvaliacaoCoordenador,
  LinkAvaliacaoCoordenador,
  QuestionarioCoordenador,
} from "./tipos";

// ─── Rotas internas (requerem autenticação ADM/ORG) ────────────────────────

export async function gerarLinkAvaliacaoCoordenador(
  edicaoId: string,
): Promise<LinkAvaliacaoCoordenador> {
  const data = await api.post<LinkAvaliacaoCoordenador>(
    "/api/avaliacao-coordenador/links",
    { edicaoId },
  );
  queryClient.invalidateQueries({ queryKey: ["avaliacaoCoordenadorLink", edicaoId] });
  return data;
}

export async function revogarLinkAvaliacaoCoordenador(token: string): Promise<void> {
  await api.put(`/api/avaliacao-coordenador/links/${token}/revogar`);
  queryClient.invalidateQueries({ queryKey: ["avaliacaoCoordenadorLink"] });
}

export async function buscarLinkAvaliacaoCoordenadorAtivo(
  edicaoId: string,
): Promise<LinkAvaliacaoCoordenador | null> {
  try {
    return await api.get<LinkAvaliacaoCoordenador>(
      `/api/avaliacao-coordenador/links/${edicaoId}`,
    );
  } catch {
    return null;
  }
}

export async function listarAvaliacoesCoordenador(
  edicaoId: string,
  filtros?: { equipeId?: string; avaliadorPessoaId?: string; status?: string },
): Promise<AvaliacaoCoordenador[]> {
  const params = new URLSearchParams({ edicaoId });
  if (filtros?.equipeId) params.set("equipeId", filtros.equipeId);
  if (filtros?.avaliadorPessoaId) params.set("avaliadorPessoaId", filtros.avaliadorPessoaId);
  if (filtros?.status) params.set("status", filtros.status);
  return api.get<AvaliacaoCoordenador[]>(`/api/avaliacoes-coordenador?${params.toString()}`);
}

export async function buscarAvaliacaoCoordenador(id: string): Promise<AvaliacaoCoordenador> {
  return api.get<AvaliacaoCoordenador>(`/api/avaliacoes-coordenador/${id}`);
}

export async function listarAvaliacoesCoordenadorPessoa(
  pessoaId: string,
): Promise<AvaliacaoCoordenador[]> {
  return api.get<AvaliacaoCoordenador[]>(`/api/avaliacoes-coordenador/pessoa/${pessoaId}`);
}

// ─── Rotas públicas (anonimas) ─────────────────────────────────────────────

export async function verificarLinkAvaliacaoCoordenador(
  referencia: string,
): Promise<{ valido: boolean; edicaoId?: string; edicaoNumero?: number }> {
  return apiPublica<{
    valido: boolean;
    edicaoId?: string;
    edicaoNumero?: number;
  }>("GET", `/api/publico/avaliacao-coordenador/${referencia}`);
}

export async function identificarCoordenadorAvaliacaoCoordenador(
  referencia: string,
  cracha: number,
): Promise<{
  nome?: string;
  equipes?: { equipeId: string; equipeNome: string; equipeNomePai: string }[];
  sessaoToken?: string;
  erro?: string;
}> {
  return apiPublica<{
    nome?: string;
    equipes?: { equipeId: string; equipeNome: string; equipeNomePai: string }[];
    sessaoToken?: string;
    erro?: string;
  }>("POST", "/api/publico/avaliacao-coordenador/coordenador", {
    token: referencia,
    cracha,
  });
}

export async function listarAlvosAvaliacaoCoordenador(
  sessaoToken: string,
): Promise<AlvoAvaliacaoCoordenador[]> {
  return api.get<AlvoAvaliacaoCoordenador[]>(
    "/api/publico/avaliacao-coordenador/alvos",
    sessaoToken,
  );
}

export async function salvarAvaliacaoCoordenador(
  sessaoToken: string,
  dados: {
    pessoaId: string;
    equipeFilhaId: string;
    permanencia: QuestionarioCoordenador["permanencia"];
    lideranca: QuestionarioCoordenador["lideranca"];
    pontoPositivo: string | null;
    aspectoMelhorar: string | null;
    situacaoRegistrar: string | null;
    recomendacao: string | null;
    finalizar: boolean;
  },
): Promise<{ id: string; status: string; atualizadoEm: string }> {
  return api.post("/api/publico/avaliacao-coordenador", dados, sessaoToken);
}