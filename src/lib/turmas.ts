import { api } from "./api";
import { queryClient } from "./queryClient";
import { Setor, TurmaFormacao } from "./tipos";
import { Sessao } from "./sessao";
import { gerarLinkDeTurma } from "./links";

export interface DadosTurmaForm {
  data: string;
  horarioInicio: string;
  horarioFim?: string;
  local: string;
  capacidadeMaxima: number | undefined;
  setorVinculo?: Setor;
  barracaIdVinculo?: string;
}

export class ErroTurma extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export function turmaDeSnap(id: string, data: Record<string, unknown>): TurmaFormacao {
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    data: (data.data as string) ?? "",
    horarioInicio: (data.horarioInicio as string) ?? "",
    horarioFim: (data.horarioFim as string) || undefined,
    local: (data.local as string) ?? "",
    capacidadeMaxima: (data.capacidadeMaxima as number) ?? 0,
    setorVinculo: (data.setorVinculo as Setor) || undefined,
    barracaIdVinculo: (data.barracaIdVinculo as string) || undefined,
    criadoEm: (data.criadoEm as string) || "",
    atualizadoEm: (data.atualizadoEm as string) || "",
  };
}

function validar(d: DadosTurmaForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.data) erros.data = "Data é obrigatória.";
  if (!d.horarioInicio) erros.horarioInicio = "Horário é obrigatório.";
  if (!d.local.trim()) erros.local = "Local é obrigatório.";
  if (
    typeof d.capacidadeMaxima !== "number" ||
    !Number.isInteger(d.capacidadeMaxima) ||
    d.capacidadeMaxima <= 0
  )
    erros.capacidadeMaxima = "Capacidade inválida.";
  return erros;
}

function invalidarTurmas(edicaoId?: string) {
  queryClient.invalidateQueries({ queryKey: ["turmas"] });
  if (edicaoId) queryClient.invalidateQueries({ queryKey: ["turmas", edicaoId] });
}

export async function criarTurma(
  sessao: Sessao,
  edicaoId: string,
  dados: DadosTurmaForm
): Promise<string> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroTurma(erros);

  const turma = await api.post<TurmaFormacao>("/api/turmas", {
    edicaoId,
    data: dados.data,
    horarioInicio: dados.horarioInicio,
    horarioFim: dados.horarioFim || null,
    local: dados.local.trim(),
    capacidadeMaxima: dados.capacidadeMaxima,
    setorVinculo: dados.setorVinculo || null,
    barracaIdVinculo: dados.barracaIdVinculo || null,
  });

  invalidarTurmas(edicaoId);

  // Gera link público automaticamente (US-06-01 + US-06-05).
  // Falhas aqui não desfazem a turma, mas borbulham para que a ORG saiba.
  await gerarLinkDeTurma(sessao, turma as TurmaFormacao);

  return turma.id as string;
}

export async function atualizarTurma(
  sessao: Sessao,
  turma: TurmaFormacao,
  dados: DadosTurmaForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroTurma(erros);

  await api.put(`/api/turmas/${turma.id}`, {
    data: dados.data,
    horarioInicio: dados.horarioInicio,
    horarioFim: dados.horarioFim || null,
    local: dados.local.trim(),
    capacidadeMaxima: dados.capacidadeMaxima,
    setorVinculo: dados.setorVinculo || null,
    barracaIdVinculo: dados.barracaIdVinculo || null,
  });

  invalidarTurmas(turma.edicaoId);

  // Se data ou horário mudaram, ajusta o prazo dos links ativos.
  if (turma.data !== dados.data || turma.horarioInicio !== dados.horarioInicio) {
    await ajustarPrazoDosLinksAtivos(sessao, { ...turma, data: dados.data, horarioInicio: dados.horarioInicio });
  }
}

// Auxiliar: ajusta prazo de links ativos de uma turma após reagendamento.
async function ajustarPrazoDosLinksAtivos(
  _sessao: Sessao,
  turma: TurmaFormacao
): Promise<void> {
  await api.put(`/api/links/turma/${turma.id}/ajustar-prazo`, {
    turmaData: turma.data,
    turmaHorarioInicio: turma.horarioInicio,
  });
  queryClient.invalidateQueries({ queryKey: ["links"] });
}

export async function removerTurma(_sessao: Sessao, turma: TurmaFormacao): Promise<void> {
  await api.delete(`/api/turmas/${turma.id}`);
  invalidarTurmas(turma.edicaoId);
  queryClient.invalidateQueries({ queryKey: ["links"] });
}
