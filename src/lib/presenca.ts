// Cliente do fluxo de presença de equipistas (013-presenca-equipistas).
import { api, apiPublica } from "./api";
import { gerarToken } from "./links";
import { queryClient } from "./queryClient";
import { LinkPresenca, PresencaRegistrada, ResumoEquipePresenca } from "./tipos";

export type StatusLinkPresenca = "ativo" | "revogado" | "naoEncontrado";

export interface DiaPresenca {
  id: string;
  edicaoId: string;
  data: string;
}

export interface RespostaVerificarLink {
  status: StatusLinkPresenca;
  dia: DiaPresenca | null;
}

export interface RespostaCoordenador {
  sessaoJwt: string;
  nome: string;
  cracha: number;
}

export interface EquipistaPresenca {
  pessoaId: string;
  nome: string;
  cracha: number;
  funcao: string;
  coordenador: boolean;
  presencaRegistrada: boolean;
}

export interface RespostaListaEquipistas {
  equipistas: EquipistaPresenca[];
}

export interface RespostaConfirmar {
  registrados: number;
  jaRegistrados: number;
  naoValidados: number;
}

export function urlPresenca(token: string): string {
  if (typeof window === "undefined") return `/presenca/${token}`;
  return `${window.location.origin}/presenca/${token}`;
}

export async function listarLinksPresenca(edicaoId: string): Promise<LinkPresenca[]> {
  return api.get<LinkPresenca[]>(`/api/presenca/links?edicaoId=${edicaoId}`);
}

export async function listarPresencasDoDia(diaFestaId: string): Promise<PresencaRegistrada[]> {
  return api.get<PresencaRegistrada[]>(`/api/presenca/presencas?diaFestaId=${diaFestaId}`);
}

export async function listarResumoEquipesDoDia(diaFestaId: string): Promise<ResumoEquipePresenca[]> {
  return api.get<ResumoEquipePresenca[]>(`/api/presenca/resumo-equipes?diaFestaId=${diaFestaId}`);
}

export async function gerarLinkPresenca(
  diaFestaId: string,
  edicaoId: string
): Promise<string> {
  const token = gerarToken();
  await api.post<LinkPresenca>("/api/presenca/links", {
    token,
    diaFestaId,
    edicaoId,
  });
  queryClient.invalidateQueries({ queryKey: ["links-presenca", edicaoId] });
  return token;
}

export async function verificarLinkPresenca(
  token: string
): Promise<RespostaVerificarLink> {
  return apiPublica<RespostaVerificarLink>("GET", `/api/publico/presenca/${token}`);
}

export async function identificarCoordenador(
  token: string,
  cracha: number
): Promise<RespostaCoordenador> {
  return apiPublica<RespostaCoordenador>("POST", "/api/publico/presenca/coordenador", {
    token,
    cracha,
  });
}

export async function listarEquipistas(
  sessaoJwt: string
): Promise<EquipistaPresenca[]> {
  const r = await api.get<RespostaListaEquipistas>(
    "/api/publico/presenca/equipistas",
    sessaoJwt
  );
  return r.equipistas ?? [];
}

export async function confirmarPresenca(
  sessaoJwt: string,
  equipistas: EquipistaPresenca[]
): Promise<RespostaConfirmar> {
  return api.post<RespostaConfirmar>(
    "/api/publico/presenca/confirmar",
    { equipistas },
    sessaoJwt
  );
}

export async function removerPresenca(
  sessaoJwt: string,
  pessoaId: string
): Promise<void> {
  await api.post<{ removida: boolean }>(
    "/api/publico/presenca/remover",
    { pessoaId },
    sessaoJwt
  );
}
