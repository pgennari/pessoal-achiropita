import { api } from "./api";
import { Sessao } from "./sessao";
import { EventoAuditoria } from "./tipos";

// registrarEvento não é mais chamado pelo frontend — a API registra
// automaticamente ao final de cada mutação. Esta função existe para
// compatibilidade com código legado que ainda a importa.
export async function registrarEvento(
  _sessao: Sessao,
  _acao: string,
  _alvo: string,
  _detalhes?: string
): Promise<void> {
  // No-op: auditoria agora é responsabilidade exclusiva do backend.
}

// Mantido para compatibilidade com hooks.ts.
export function consultaAuditoriaRecente(_qtd = 100) {
  return null;
}

export function eventoDeSnap(id: string, data: Record<string, unknown>): EventoAuditoria {
  return {
    id,
    acao: (data.acao as string) ?? "",
    alvo: (data.alvo as string) ?? "",
    autor: (data.autor as string) ?? "",
    autorNome: (data.autorNome as string) ?? "",
    detalhes: (data.detalhes as string | null) ?? undefined,
    criadoEm: (data.criadoEm as string) || "",
  };
}

export async function listarAuditoriaRecente(qtd = 100): Promise<EventoAuditoria[]> {
  return api.get<EventoAuditoria[]>(`/api/auditoria?qtd=${qtd}`);
}
