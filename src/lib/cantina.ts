// Cliente da area Cantina > Pesquisa (020-cantina-pesquisa).
// A listagem usa a API autenticada; o formulario publico usa rotas anonimas.
import { api, apiPublica } from "./api";
import type { PesquisaCantina, NotasPesquisa, RecomendariaCantina } from "./tipos";

export interface ListaPesquisas {
  itens: PesquisaCantina[];
  total: number;
  temMais: boolean;
}

export interface DadosPesquisaForm {
  nome: string;
  email: string | null;
  telefone: string | null;
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

// Envio anonimo do formulario publico.
export async function enviarPesquisa(payload: DadosPesquisaForm): Promise<void> {
  await apiPublica<{ ok: boolean }>(
    "POST",
    "/api/publico/cantina/pesquisas",
    payload
  );
}
