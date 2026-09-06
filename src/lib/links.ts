import { api } from "./api";
import { queryClient } from "./queryClient";
import { LinkValidacao, StatusLink, TurmaFormacao } from "./tipos";
import { Sessao } from "./sessao";

const MINUTOS_APOS_INICIO = 15;

export class ErroLink extends Error {}

export function statusDoLink(
  link: LinkValidacao
): "ativo" | "expirado" | "revogado" {
  if (link.status === "revogado") return "revogado";
  if (new Date(link.expiraEm) <= new Date()) return "expirado";
  return "ativo";
}

export function gerarToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function linkDeSnap(id: string, data: Record<string, unknown>): LinkValidacao {
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    turmaId: (data.turmaId as string) ?? "",
    expiraEm: (data.expiraEm as string) || "",
    status: (data.status as StatusLink) ?? "ativo",
    contadorUsos: (data.contadorUsos as number) ?? 0,
    rotuloOpcional: (data.rotuloOpcional as string) || undefined,
    criadoPorUid: (data.criadoPorUid as string) ?? "",
    criadoPorNome: (data.criadoPorNome as string) ?? "",
    criadoEm: (data.criadoEm as string) || "",
  };
}

export function calcularExpiracaoDaTurma(turma: TurmaFormacao): Date {
  if (!turma.data || !turma.horarioInicio) {
    return new Date(Date.now() + 60 * 60 * 1000);
  }
  const inicio = new Date(`${turma.data}T${turma.horarioInicio}:00`);
  return new Date(inicio.getTime() + MINUTOS_APOS_INICIO * 60 * 1000);
}

export async function gerarLinkDeTurma(
  _sessao: Sessao,
  turma: TurmaFormacao,
  expiraEm?: Date
): Promise<string> {
  if (!turma.id || !turma.edicaoId) {
    throw new ErroLink("Turma inválida.");
  }
  const prazo = expiraEm ?? calcularExpiracaoDaTurma(turma);
  if (prazo <= new Date()) {
    throw new ErroLink("Prazo de expiração precisa ser no futuro.");
  }
  const token = gerarToken();
  await api.post<LinkValidacao>("/api/links", {
    token,
    turmaId: turma.id,
    edicaoId: turma.edicaoId,
    expiraEm: prazo.toISOString(),
  });
  queryClient.invalidateQueries({ queryKey: ["links"] });
  return token;
}

export async function revogarLink(_sessao: Sessao, link: LinkValidacao): Promise<void> {
  await api.put(`/api/links/${link.id}/revogar`);
  queryClient.invalidateQueries({ queryKey: ["links"] });
}

// Mantido para compatibilidade: o backend já ajusta em cascade
// quando PUT /api/turmas/:id é chamado com data/horário diferentes.
// Esta função não faz nada no frontend (a lógica fica em turmas.ts
// que chama PUT /api/links/turma/:turmaId/ajustar-prazo diretamente).
export async function ajustarPrazoDosLinksAtivos(
  _sessao: Sessao,
  _turma: TurmaFormacao
): Promise<number> {
  return 0;
}

export async function revogarLinksDaTurma(
  _sessao: Sessao,
  _turmaId: string
): Promise<number> {
  // Revogação em cascade feita pelo backend ao deletar a turma.
  return 0;
}

export function urlPublica(token: string): string {
  if (typeof window === "undefined") return `/v/${token}`;
  return `${window.location.origin}/v/${token}`;
}
