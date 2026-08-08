// Cliente da sincronizacao com planilha Google Sheets (somente ADM).
// Espelha os contratos de api/src/rotas/sincronizacao.ts.

import { api } from "./api";
import { queryClient } from "./queryClient";

export interface MapeamentoCampos {
  cracha?: string;
  nome?: string;
  equipe?: string;
  funcao?: string;
  setor?: string;
  telefone?: string;
  nascimento?: string;
  email?: string;
}

export type Campo = keyof MapeamentoCampos;

export interface DadosPlanilha {
  planilhaId: string;
  abas: string[];
  cabecalho: string[];
  amostra: string[][];
  abaSalva?: string;
  mapeamentoSalvo?: MapeamentoCampos;
}

export interface PlanilhaAcessada {
  planilha_id: string;
  aba: string | null;
  mapeamento: MapeamentoCampos | null;
  autor_nome: string;
  atualizado_em: string;
}

export type TipoDiffSincronizacao =
  | "pessoa.nome"
  | "pessoa.telefone"
  | "pessoa.email"
  | "pessoa.nascimento"
  | "pessoa.faltante"
  | "equipe.faltante"
  | "equipe.nome"
  | "equipe.setor"
  | "participacao.faltante"
  | "participacao.equipe"
  | "participacao.funcao";

export interface DiffSincronizacao {
  id: string;
  tipo: TipoDiffSincronizacao;
  linha: number;
  cracha?: number;
  pessoaId?: string;
  pessoaNomeSistema?: string;
  equipeId?: string;
  rotuloCampo?: string;
  valorPlanilha: string | null;
  valorSistema: string | null;
  dados?: { telefone?: string; nascimento?: string; email?: string };
  faltamObrigatorios?: string[];
}

export interface AvisoSincronizacao {
  linha: number;
  cracha?: number;
  motivo: string;
}

export interface RelatorioSincronizacao {
  edicao: { id: string; numero: number; ano: number };
  totalLinhas: number;
  diffs: DiffSincronizacao[];
  avisos: AvisoSincronizacao[];
}

export interface DecisaoAplicar {
  id: string;
  dados?: { telefone?: string; nascimento?: string; email?: string };
  modo?: "remover";
}

export interface ResultadoAplicacao {
  aplicadas: { id: string }[];
  falhas: { id: string; motivo: string }[];
  pendentes: number;
}

export async function obterDadosPlanilha(
  planilhaId: string
): Promise<DadosPlanilha> {
  return api.get<DadosPlanilha>(
    `/api/sincronizacao/planilha?planilhaId=${encodeURIComponent(planilhaId)}`
  );
}

export async function historicoPlanilhas(): Promise<PlanilhaAcessada[]> {
  return api.get<PlanilhaAcessada[]>("/api/sincronizacao/historico");
}

export async function compararPlanilha(
  planilhaId: string,
  aba: string,
  mapeamento: MapeamentoCampos
): Promise<RelatorioSincronizacao> {
  return api.post<RelatorioSincronizacao>("/api/sincronizacao/comparar", {
    planilhaId,
    aba,
    mapeamento,
  });
}

export async function aplicarPlanilha(
  planilhaId: string,
  aba: string,
  mapeamento: MapeamentoCampos,
  decisoes: DecisaoAplicar[]
): Promise<ResultadoAplicacao> {
  const resultado = await api.post<ResultadoAplicacao>("/api/sincronizacao/aplicar", {
    planilhaId,
    aba,
    mapeamento,
    decisoes,
  });
  await queryClient.invalidateQueries({
    queryKey: ["pessoas"],
  });
  await queryClient.invalidateQueries({
    queryKey: ["equipes"],
  });
  await queryClient.invalidateQueries({
    queryKey: ["participacoes"],
  });
  return resultado;
}

export function rotuloTipoDiff(tipo: TipoDiffSincronizacao): string {
  const rotulos: Record<TipoDiffSincronizacao, string> = {
    "pessoa.nome": "Nome",
    "pessoa.telefone": "Telefone",
    "pessoa.email": "E-mail",
    "pessoa.nascimento": "Nascimento",
    "pessoa.faltante": "Nova pessoa",
    "equipe.faltante": "Nova equipe",
    "equipe.nome": "Equipe",
    "equipe.setor": "Setor",
    "participacao.faltante": "Nova participação",
    "participacao.equipe": "Equipe",
    "participacao.funcao": "Função",
  };
  return rotulos[tipo];
}
