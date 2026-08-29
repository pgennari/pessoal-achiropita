// Cliente da area Montagem de Equipes (022-montagem-equipes).
// Listagem paginada de candidatos com match e detalhamento historico.
import { api } from "./api";
import type {
  CandidatoMontagem,
  MatchHistoricoResponse,
} from "./tipos";

export interface ListaCandidatosMontagem {
  itens: CandidatoMontagem[];
  total: number;
  temMais: boolean;
}

// Lote de candidatos com pontuacao de match para uma equipe.
export async function listarCandidatosMontagem(
  edicaoId: string,
  equipeId: string,
  offset: number
): Promise<ListaCandidatosMontagem> {
  return api.get<ListaCandidatosMontagem>(
    `/api/montagem/candidatos?edicaoId=${edicaoId}&equipeId=${equipeId}&offset=${offset}&limit=20`
  );
}

// Detalhar historico de match de uma pessoa por edicoes anteriores.
export async function buscarMatchHistorico(
  pessoaId: string,
  edicaoId: string
): Promise<MatchHistoricoResponse> {
  return api.get<MatchHistoricoResponse>(
    `/api/montagem/match/${pessoaId}?edicaoId=${edicaoId}`
  );
}
