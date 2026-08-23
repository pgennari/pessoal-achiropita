// Cliente da area Cantina > Pesquisa (020-cantina-pesquisa).
// A listagem usa a API autenticada; o formulario publico usa rotas anonimas.
import { api, apiPublica } from "./api";
import type { PesquisaCantina, NotasPesquisa, RecomendariaCantina } from "./tipos";

export interface DiaFestaPublico {
  id: string;
  data: string; // YYYY-MM-DD
}

export interface ListaPesquisas {
  itens: PesquisaCantina[];
  total: number;
  temMais: boolean;
}

export interface DadosPesquisaForm {
  nome: string;
  email: string | null;
  telefone: string | null;
  diaIda: string | null;
  convite: string | null;
  desejaInformacoes: boolean;
  notas: NotasPesquisa;
  recomendaria: RecomendariaCantina;
  melhorias: string | null;
}

// Lote de pesquisas mais recentes (offset em multiplos de 20).
export async function listarPesquisas(offset: number): Promise<ListaPesquisas> {
  return api.get<ListaPesquisas>(
    `/api/cantina/pesquisas?offset=${offset}&limit=20`
  );
}

// Dias de festa da edicao ativa para o campo "Dia da ida".
export async function listarDiasPublicos(): Promise<DiaFestaPublico[]> {
  const dados = await apiPublica<{ dias: DiaFestaPublico[] }>(
    "GET",
    "/api/publico/cantina/dias-festa"
  );
  return dados.dias ?? [];
}

// Envio anonimo do formulario publico.
export async function enviarPesquisa(payload: DadosPesquisaForm): Promise<void> {
  await apiPublica<{ ok: boolean }>(
    "POST",
    "/api/publico/cantina/pesquisas",
    payload
  );
}
