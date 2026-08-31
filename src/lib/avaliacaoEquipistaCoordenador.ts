import { api, apiPublica } from "./api";
import { queryClient } from "./queryClient";
import {
  AlvoAvaliacaoEquipista,
  AvaliacaoEquipistaCoordenador,
  LinkAvaliacaoEquipista,
  QuestionarioEquipistaCoordenador,
} from "./tipos";

// ─── Rotas internas (requerem autenticação ADM/ORG) ────────────────────────

export async function gerarLinkAvaliacaoEquipista(
  edicaoId: string,
): Promise<LinkAvaliacaoEquipista> {
  const data = await api.post<LinkAvaliacaoEquipista>(
    "/api/avaliacao-equipista/links",
    { edicaoId },
  );
  queryClient.invalidateQueries({ queryKey: ["avaliacaoEquipistaLink", edicaoId] });
  return data;
}

export async function revogarLinkAvaliacaoEquipista(token: string): Promise<void> {
  await api.put(`/api/avaliacao-equipista/links/${token}/revogar`);
  queryClient.invalidateQueries({ queryKey: ["avaliacaoEquipistaLink"] });
}

export async function buscarLinkAvaliacaoEquipistaAtivo(
  edicaoId: string,
): Promise<LinkAvaliacaoEquipista | null> {
  try {
    return await api.get<LinkAvaliacaoEquipista>(
      `/api/avaliacao-equipista/links/${edicaoId}`,
    );
  } catch {
    return null;
  }
}

export async function listarAvaliacoesEquipistaCoordenador(
  edicaoId: string,
  filtros?: { equipeId?: string; avaliadorPessoaId?: string; status?: string },
): Promise<AvaliacaoEquipistaCoordenador[]> {
  const params = new URLSearchParams({ edicaoId });
  if (filtros?.equipeId) params.set("equipeId", filtros.equipeId);
  if (filtros?.avaliadorPessoaId) params.set("avaliadorPessoaId", filtros.avaliadorPessoaId);
  if (filtros?.status) params.set("status", filtros.status);
  return api.get<AvaliacaoEquipistaCoordenador[]>(
    `/api/avaliacoes-equipista-coordenador?${params.toString()}`,
  );
}

export async function buscarAvaliacaoEquipistaCoordenador(
  id: string,
): Promise<AvaliacaoEquipistaCoordenador> {
  return api.get<AvaliacaoEquipistaCoordenador>(`/api/avaliacoes-equipista-coordenador/${id}`);
}

export async function listarAvaliacoesEquipistaCoordenadorPessoa(
  pessoaId: string,
): Promise<AvaliacaoEquipistaCoordenador[]> {
  return api.get<AvaliacaoEquipistaCoordenador[]>(
    `/api/avaliacoes-equipista-coordenador/pessoa/${pessoaId}`,
  );
}

// ─── Rotas públicas (anonimas) ─────────────────────────────────────────────

export async function verificarLinkAvaliacaoEquipista(
  referencia: string,
): Promise<{ valido: boolean; edicaoId?: string; edicaoNumero?: number }> {
  return apiPublica<{
    valido: boolean;
    edicaoId?: string;
    edicaoNumero?: number;
  }>("GET", `/api/publico/avaliacao-equipista/${referencia}`);
}

export async function identificarEquipista(
  referencia: string,
  cracha: number,
): Promise<{
  nome?: string;
  fotoUrl?: string | null;
  equipeNome?: string;
  sessaoToken?: string;
  jaEnviou?: boolean;
  erro?: string;
}> {
  return apiPublica<{
    nome?: string;
    fotoUrl?: string | null;
    equipeNome?: string;
    sessaoToken?: string;
    jaEnviou?: boolean;
    erro?: string;
  }>("POST", "/api/publico/avaliacao-equipista/identificar", {
    token: referencia,
    cracha,
  });
}

export async function listarAlvosAvaliacaoEquipista(
  sessaoToken: string,
): Promise<AlvoAvaliacaoEquipista[]> {
  return api.get<AlvoAvaliacaoEquipista[]>(
    "/api/publico/avaliacao-equipista/alvos",
    sessaoToken,
  );
}

export async function salvarAvaliacaoEquipistaCoordenador(
  sessaoToken: string,
  dados: {
    pessoaId: string;
    criterios: QuestionarioEquipistaCoordenador["criterios"];
    comentarios: string | null;
  },
): Promise<{ id: string; status: string; finalizadoEm: string }> {
  return api.post("/api/publico/avaliacao-equipista", dados, sessaoToken);
}
