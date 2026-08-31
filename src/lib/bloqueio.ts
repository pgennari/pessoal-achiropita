// Cliente de API do fluxo de bloqueio/desbloqueio de pessoas (025-bloqueio-pessoa).
// Todos os endpoints exigem a permissao `pessoas.bloqueio`.
import { api } from "./api";
import { queryClient } from "./queryClient";
import { Bloqueio, StatusBloqueio, TipoBloqueio } from "./tipos";
import { Sessao } from "./sessao";

// O bloqueio afeta praticamente tudo que envolve a pessoa: listagens, detalhe e
// alocacoes. Invalidar todas as chaves relacionadas.
function invalidarBloqueios() {
  queryClient.invalidateQueries({ queryKey: ["bloqueios"] });
  queryClient.invalidateQueries({ queryKey: ["pessoas"] });
  queryClient.invalidateQueries({ queryKey: ["participacoes"] });
  queryClient.invalidateQueries({ queryKey: ["equipes"] });
}

// Um usuario nunca aprova o proprio pedido (FR-009): o backend rejeita com 409;
// o front usa o mesmo criterio para desabilitar/ocultar o botao de aprovar.
// Aceita tanto um lance completo (Bloqueio) quanto o resumo pendente do detalhe.
export function podeAprovar(
  bloqueio: { aprovador1Uid: string },
  sessao: Sessao | null
): boolean {
  return !!sessao && sessao.uid !== bloqueio.aprovador1Uid;
}

export interface ListarBloqueiosArgs {
  pessoaId?: string;
  status?: StatusBloqueio;
}

export async function listarBloqueios(
  args: ListarBloqueiosArgs = {}
): Promise<Bloqueio[]> {
  const params = new URLSearchParams();
  if (args.pessoaId) params.set("pessoaId", args.pessoaId);
  if (args.status) params.set("status", args.status);
  const qs = params.toString();
  const resposta = await api.get<{ itens: Bloqueio[] }>(
    `/api/bloqueios${qs ? `?${qs}` : ""}`
  );
  return resposta.itens;
}

export async function criarSolicitacaoBloqueio(
  _sessao: Sessao,
  args: { pessoaId: string; tipo: TipoBloqueio; motivo: string }
): Promise<Bloqueio> {
  const bloqueio = await api.post<Bloqueio>("/api/bloqueios", args);
  invalidarBloqueios();
  return bloqueio;
}

export async function aprovarSolicitacaoBloqueio(
  _sessao: Sessao,
  id: string
): Promise<Bloqueio> {
  const bloqueio = await api.post<Bloqueio>(`/api/bloqueios/${id}/aprovar`, {});
  invalidarBloqueios();
  return bloqueio;
}