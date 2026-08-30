import { api } from "./api";
import { queryClient } from "./queryClient";
import { Comunicado } from "./tipos";

export interface DadosComunicadoForm {
  titulo: string;
  corpo: string;
}

function invalidarComunicados(edicaoId: string) {
  queryClient.invalidateQueries({ queryKey: ["comunicados", edicaoId] });
}

export async function listarComunicados(
  edicaoId: string
): Promise<Comunicado[]> {
  return api.get<Comunicado[]>(`/api/comunicados?edicaoId=${edicaoId}`);
}

export async function criarComunicado(
  edicaoId: string,
  dados: DadosComunicadoForm
): Promise<Comunicado> {
  const comunicado = await api.post<Comunicado>("/api/comunicados", {
    edicaoId,
    ...dados,
  });
  invalidarComunicados(edicaoId);
  return comunicado;
}

export async function atualizarComunicado(
  comunicado: Comunicado,
  dados: DadosComunicadoForm
): Promise<Comunicado> {
  const atualizado = await api.put<Comunicado>(
    `/api/comunicados/${comunicado.id}`,
    dados
  );
  invalidarComunicados(comunicado.edicaoId);
  return atualizado;
}

export async function removerComunicado(comunicado: Comunicado): Promise<void> {
  await api.delete(`/api/comunicados/${comunicado.id}`);
  invalidarComunicados(comunicado.edicaoId);
}

export type GrupoDestinatarios = "todos" | "coordenadores" | "teste";

export interface ResultadoEnvioComunicado {
  enviados: number;
  messageId: string;
}

export async function enviarComunicado(
  comunicado: Comunicado,
  grupo: GrupoDestinatarios
): Promise<ResultadoEnvioComunicado> {
  return api.post<ResultadoEnvioComunicado>(
    `/api/comunicados/${comunicado.id}/enviar`,
    { grupo }
  );
}