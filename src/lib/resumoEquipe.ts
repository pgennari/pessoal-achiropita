// Resumo de equipe (feature Resumo): cinco valores numericos, cada um
// preenchido pelo coordenador da equipe correspondente na edicao.
import { api } from "./api";
import type { CampoResumoEquipe, ResumoEquipe } from "./tipos";
import { CAMPOS_RESUMO_EQUIPE } from "./tipos";

// Nome (na edicao) da equipe cujo coordenador preenche cada campo.
export const NOME_EQUIPE_DO_CAMPO: Record<CampoResumoEquipe, string> = {
  gestaoEstacionamento: "Gestão de Estacionamentos",
  suplentes: "Suplentes",
  contratados: "Contratados",
  controlePessoal: "Controle Pessoal",
  supervisaoPessoal: "Supervisão Pessoal",
  apoioPessoal: "Apoio Pessoal",
};

// Campos do resumo ordenados alfabeticamente pelo nome da equipe avaliadora.
export const CAMPOS_RESUMO_EQUIPE_ORDENADOS: CampoResumoEquipe[] = [
  ...CAMPOS_RESUMO_EQUIPE,
].sort((a, b) =>
  NOME_EQUIPE_DO_CAMPO[a].localeCompare(NOME_EQUIPE_DO_CAMPO[b], "pt-BR"),
);

// Nome normalizado (caixa baixa, sem acentos, espacos colapsados) para
// comparar os nomes das equipes da edicao com o rotulo de cada campo.
export function normalizarNomeResumo(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listarResumoEquipe(
  equipeId: string
): Promise<ResumoEquipe> {
  return api.get<ResumoEquipe>(`/api/resumos-equipe/${equipeId}`);
}

export async function atualizarResumoEquipe(
  equipeId: string,
  campo: CampoResumoEquipe,
  valor: string | null
): Promise<ResumoEquipe> {
  return api.put<ResumoEquipe>(`/api/resumos-equipe/${equipeId}`, {
    campo,
    valor,
  });
}

export async function votarResumoEquipe(
  equipeId: string,
  campo: CampoResumoEquipe,
  voto: "curtir" | "descurtir"
): Promise<ResumoEquipe> {
  return api.put<ResumoEquipe>(`/api/resumos-equipe/${equipeId}/voto`, {
    campo,
    voto,
  });
}