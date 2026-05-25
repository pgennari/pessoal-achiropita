import { api } from "./api";
import { queryClient } from "./queryClient";
import { EntregaCracha } from "./tipos";
import { Sessao } from "./sessao";

export class ErroEntrega extends Error {}

export function idEntrega(edicaoId: string, pessoaId: string): string {
  return `${edicaoId}__${pessoaId}`;
}

export function entregaDeSnap(id: string, data: Record<string, unknown>): EntregaCracha {
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    pessoaId: (data.pessoaId as string) ?? "",
    entregueEm: (data.entregueEm as string) || "",
    operadorUid: (data.operadorUid as string) ?? "",
    operadorNome: (data.operadorNome as string) ?? "",
    observacao: (data.observacao as string) || undefined,
  };
}

function invalidarEntregas() {
  queryClient.invalidateQueries({ queryKey: ["entregas"] });
}

export async function marcarEntregue(
  _sessao: Sessao,
  args: {
    edicaoId: string;
    pessoaId: string;
    pessoaNome: string;
    cracha: number;
    observacao?: string;
  }
): Promise<void> {
  await api.post("/api/entregas", {
    edicaoId: args.edicaoId,
    pessoaId: args.pessoaId,
    pessoaNome: args.pessoaNome,
    cracha: args.cracha,
    observacao: args.observacao ?? null,
  });
  invalidarEntregas();
}

export async function desbloquearEntrega(
  _sessao: Sessao,
  args: { edicaoId: string; pessoaId: string; pessoaNome: string; cracha: number }
): Promise<void> {
  const id = idEntrega(args.edicaoId, args.pessoaId);
  await api.delete(`/api/entregas/${id}`);
  invalidarEntregas();
}
