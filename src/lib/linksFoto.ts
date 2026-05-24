import { Sessao } from "./sessao";

// TODO(US-07-01): links de foto removidos do MVP.
// O upload de foto via link público será implementado em iteração futura.

export interface LinkFoto {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  expiraEm: string;
  status: "ativo" | "usado" | "revogado";
  criadoPorUid: string;
  criadoPorNome: string;
  criadoEm: string;
}

export function linkFotoDeSnap(id: string, data: Record<string, unknown>): LinkFoto {
  return {
    id,
    pessoaId: (data.pessoaId as string) ?? "",
    pessoaNome: (data.pessoaNome as string) ?? "",
    expiraEm: (data.expiraEm as string) || "",
    status: (data.status as LinkFoto["status"]) ?? "ativo",
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    criadoEm: (data.criadoEm as string) || "",
  };
}

export async function gerarLinkFoto(
  _sessao: Sessao,
  _pessoaId: string,
  _pessoaNome: string
): Promise<string> {
  throw new Error("TODO(US-07-01): links de foto não implementados no MVP.");
}

export async function marcarLinkFotoUsado(_token: string): Promise<void> {
  throw new Error("TODO(US-07-01): links de foto não implementados no MVP.");
}

export function urlPublicaFoto(token: string): string {
  if (typeof window === "undefined") return `/foto/${token}`;
  return `${window.location.origin}/foto/${token}`;
}
