// Hooks de leitura de dados — substituem o padrão onSnapshot do Firestore.
// Usa @tanstack/react-query: cache, loading state e refetch após mutações.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueries, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "./api";
import {
  Avaliacao,
  Bloqueio,
  Checkin,
  Convite,
  DiaFesta,
  Edicao,
  Equipe,
  Estacionamento,
  EventoAuditoria,
  Formacao,
  HistoricoEquipePessoa,
  HistoricoEstacionamentoVaga,
  LinkAvaliacao,
  LinkPresenca,
  LinkValidacao,
  Participacao,
  ParticipacaoHistorica,
  Parametro,
  Parentesco,
  Permissao,
  Pessoa,
  PessoaComVeiculos,
  PresencaRegistrada,
  ResumoEquipePresenca,
  SetorInfo,
  StatusBloqueio,
  TurmaFormacao,
  Usuario,
  Vaga,
  Veiculo,
  VeiculoComPessoas,
} from "./tipos";
import {
  buscarEstacionamentoPublico,
  buscarHistoricoPublico,
} from "./checkin";
import { listarParentes } from "./parentes";
import {
  listarPresencasDePessoa,
  listarPresencasDoDia,
  listarResumoEquipesDoDia,
} from "./presenca";
import type { DashboardInicial } from "./dashboard";
import { PerfilInfo } from "./tipos";
import { listarCandidatosMontagem } from "./montagem";
import { listarBloqueios } from "./bloqueio";

export interface EstadoLista<T> {
  itens: T[];
  carregando: boolean;
  erro: string | null;
  atualizadoEm?: number;
}

export interface EstadoItem<T> {
  item: T | null;
  carregando: boolean;
  erro: string | null;
}

// ─── Pessoas ─────────────────────────────────────────────────────────────────

export function usePessoas(): EstadoLista<Pessoa> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pessoas"],
    queryFn: () => api.get<Pessoa[]>("/api/pessoas"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

export function usePessoa(id: string | undefined): EstadoItem<Pessoa> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pessoas", id],
    queryFn: () => api.get<Pessoa>(`/api/pessoas/${id}`),
    enabled: !!id,
  });
  return { item: data ?? null, carregando: isLoading && !!id, erro: erroMsg(error) };
}

// ─── Edições ─────────────────────────────────────────────────────────────────

export function useEdicoes(): EstadoLista<Edicao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["edicoes"],
    queryFn: () => api.get<Edicao[]>("/api/edicoes"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

export interface EstadoEdicaoAtiva {
  edicao: Edicao | null;
  carregando: boolean;
  erro: string | null;
}

export function useEdicaoAtiva(): EstadoEdicaoAtiva {
  const { data, isLoading, error } = useQuery({
    queryKey: ["edicoes", "ativa"],
    queryFn: () => api.get<Edicao | null>("/api/edicoes/ativa"),
  });
  return { edicao: data ?? null, carregando: isLoading, erro: erroMsg(error) };
}

export function useEdicao(id: string | undefined): EstadoItem<Edicao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["edicoes", id],
    queryFn: () => api.get<Edicao>(`/api/edicoes/${id}`),
    enabled: !!id,
  });
  return { item: data ?? null, carregando: isLoading && !!id, erro: erroMsg(error) };
}

// ─── Dias de festa ───────────────────────────────────────────────────────────

export function useDiasFesta(edicaoId: string | undefined): EstadoLista<DiaFesta> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dias-festa", edicaoId],
    queryFn: () => api.get<DiaFesta[]>(`/api/dias-festa?edicaoId=${edicaoId}`),
    enabled: !!edicaoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

// ─── Equipes ──────────────────────────────────────────────────────────────────

export function useEquipes(edicaoId: string | undefined): EstadoLista<Equipe> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["equipes", edicaoId],
    queryFn: () => api.get<Equipe[]>(`/api/equipes?edicaoId=${edicaoId}`),
    enabled: !!edicaoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

export function useEquipe(id: string | undefined): EstadoItem<Equipe> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["equipes", id],
    queryFn: () => api.get<Equipe>(`/api/equipes/${id}`),
    enabled: !!id,
  });
  return { item: data ?? null, carregando: isLoading && !!id, erro: erroMsg(error) };
}

export function useTodasEquipes(): EstadoLista<Equipe> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["equipes"],
    queryFn: () => api.get<Equipe[]>("/api/equipes"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Relatório de equipistas por equipe ───────────────────────────────────────

// Uma linha do relatorio de nº de equipistas (GET /api/equipes/relatorio-equipistas).
export interface LinhaRelatorioEquipistas {
  id: string;
  nome: string;
  setor: string;
  coordenadores: number;
  equipistas: number;
}

export function useRelatorioEquipistas(
  edicaoId: string | undefined
): EstadoLista<LinhaRelatorioEquipistas> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["relatorio-equipistas", edicaoId],
    queryFn: () =>
      api.get<LinhaRelatorioEquipistas[]>(
        `/api/equipes/relatorio-equipistas?edicaoId=${edicaoId}`
      ),
    enabled: !!edicaoId,
  });
  return {
    itens: data ?? [],
    carregando: isLoading && !!edicaoId,
    erro: erroMsg(error),
  };
}

// ─── Participações ────────────────────────────────────────────────────────────

export function useParticipacoes(edicaoId: string | undefined): EstadoLista<Participacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["participacoes", "edicao", edicaoId],
    queryFn: () => api.get<Participacao[]>(`/api/participacoes?edicaoId=${edicaoId}`),
    enabled: !!edicaoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

export function useParticipacoesDePessoa(pessoaId: string | undefined): EstadoLista<Participacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["participacoes", "pessoa", pessoaId],
    queryFn: () => api.get<Participacao[]>(`/api/participacoes?pessoaId=${pessoaId}`),
    enabled: !!pessoaId,
  });
  return { itens: data ?? [], carregando: isLoading && !!pessoaId, erro: erroMsg(error) };
}

export function useTodasParticipacoes(): EstadoLista<Participacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["participacoes"],
    queryFn: () => api.get<Participacao[]>("/api/participacoes"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

export function useHistoricoParticipacoesDePessoa(
  pessoaId: string | undefined
): EstadoLista<ParticipacaoHistorica> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["historico-participacoes", pessoaId],
    queryFn: () =>
      api.get<ParticipacaoHistorica[]>(
        `/api/historico-participacoes?pessoaId=${pessoaId}`
      ),
    enabled: !!pessoaId,
  });
  return { itens: data ?? [], carregando: isLoading && !!pessoaId, erro: erroMsg(error) };
}

export function useTodosHistoricosParticipacao(): EstadoLista<ParticipacaoHistorica> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["historico-participacoes"],
    queryFn: () =>
      api.get<ParticipacaoHistorica[]>("/api/historico-participacoes"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// Indexa pessoas por id — útil em telas que cruzam participações com pessoas.
export function useIndicePessoas(pessoas: Pessoa[]) {
  return useMemo(() => {
    const porId = new Map<string, Pessoa>();
    for (const p of pessoas) porId.set(p.id, p);
    return porId;
  }, [pessoas]);
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

export function useUsuarios(): EstadoLista<Usuario> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => api.get<Usuario[]>("/api/usuarios"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Perfis ────────────────────────────────────────────────────────────────────

export function usePerfis(): EstadoLista<PerfilInfo> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["perfis"],
    queryFn: () => api.get<PerfilInfo[]>("/api/perfis"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Permissoes ────────────────────────────────────────────────────────────────

export function usePermissoes(): EstadoLista<Permissao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["permissoes"],
    queryFn: () => api.get<Permissao[]>("/api/permissoes"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Parametros ───────────────────────────────────────────────────────────────

export function useParametros(): EstadoLista<Parametro> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["parametros"],
    queryFn: () => api.get<Parametro[]>("/api/parametros?todos=true"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Turmas de formação ───────────────────────────────────────────────────────

export function useTurmasFormacao(edicaoId: string | undefined): EstadoLista<TurmaFormacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["turmas", edicaoId],
    queryFn: () => api.get<TurmaFormacao[]>(`/api/turmas?edicaoId=${edicaoId}`),
    enabled: !!edicaoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

// ─── Formações ────────────────────────────────────────────────────────────────

export function useFormacoes(edicaoId: string | undefined): EstadoLista<Formacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["formacoes", edicaoId],
    queryFn: () => api.get<Formacao[]>(`/api/formacoes?edicaoId=${edicaoId}`),
    enabled: !!edicaoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

// ─── Links de validação ───────────────────────────────────────────────────────

export function useLinksEdicao(edicaoId: string | undefined): EstadoLista<LinkValidacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["links", "edicao", edicaoId],
    queryFn: () => api.get<LinkValidacao[]>(`/api/links?edicaoId=${edicaoId}`),
    enabled: !!edicaoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

export function useLinksDaTurma(turmaId: string | undefined): EstadoLista<LinkValidacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["links", "turma", turmaId],
    queryFn: () => api.get<LinkValidacao[]>(`/api/links?turmaId=${turmaId}`),
    enabled: !!turmaId,
  });
  return { itens: data ?? [], carregando: isLoading && !!turmaId, erro: erroMsg(error) };
}

// ─── Links de presença ─────────────────────────────────────────────────────────

export function useLinksPresenca(edicaoId: string | undefined): EstadoLista<LinkPresenca> {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["links-presenca", edicaoId],
    queryFn: () => api.get<LinkPresenca[]>(`/api/presenca/links?edicaoId=${edicaoId}`),
    enabled: !!edicaoId,
    refetchInterval: 60_000,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error), atualizadoEm: dataUpdatedAt };
}

// ─── Presenças confirmadas ────────────────────────────────────────────────────

export function usePresencasDoDia(diaFestaId: string | undefined): EstadoLista<PresencaRegistrada> {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["presencas", "dia", diaFestaId],
    queryFn: () => listarPresencasDoDia(diaFestaId as string),
    enabled: !!diaFestaId,
    refetchInterval: 60_000,
  });
  return { itens: data ?? [], carregando: isLoading && !!diaFestaId, erro: erroMsg(error), atualizadoEm: dataUpdatedAt };
}

export function usePresencasDePessoaNaEdicao(
  pessoaId: string | undefined,
  edicaoId: string | undefined
): EstadoLista<PresencaRegistrada> {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["presencas", "pessoa", pessoaId, "edicao", edicaoId],
    queryFn: () => listarPresencasDePessoa(pessoaId as string, edicaoId as string),
    enabled: !!pessoaId && !!edicaoId,
    refetchInterval: 60_000,
  });
  return { itens: data ?? [], carregando: isLoading && !!pessoaId && !!edicaoId, erro: erroMsg(error), atualizadoEm: dataUpdatedAt };
}

export function useResumoEquipesDoDia(diaFestaId: string | undefined): EstadoLista<ResumoEquipePresenca> {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["presencas", "resumo-equipes", diaFestaId],
    queryFn: () => listarResumoEquipesDoDia(diaFestaId as string),
    enabled: !!diaFestaId,
    refetchInterval: 60_000,
  });
  return { itens: data ?? [], carregando: isLoading && !!diaFestaId, erro: erroMsg(error), atualizadoEm: dataUpdatedAt };
}

// Resumo de equipes de todos os dias de festa de uma edicao, em uma unica lista.
// Usa useQueries com a mesma queryKey de useResumoEquipesDoDia para reaproveitar
// o cache das telas de presenca.
export interface ResumoEquipePresencaDia extends ResumoEquipePresenca {
  diaFestaId: string;
}

export function useResumoEquipesDaEdicao(
  edicaoId: string | undefined,
  dias: DiaFesta[]
): EstadoLista<ResumoEquipePresencaDia> {
  const resultados = useQueries({
    queries: dias.map((dia) => ({
      queryKey: ["presencas", "resumo-equipes", dia.id],
      queryFn: () => listarResumoEquipesDoDia(dia.id),
      enabled: !!edicaoId,
      refetchInterval: 60_000,
    })),
  });
  const itens = resultados.flatMap((r, i) =>
    (r.data ?? []).map((item) => ({ ...item, diaFestaId: dias[i].id }))
  );
  const carregando = resultados.some((r) => r.isLoading);
  const erro =
    resultados.map((r) => erroMsg(r.error)).find((e) => e !== null) ?? null;
  return { itens, carregando, erro };
}

// Presencas de todos os dias de festa de uma edicao, em uma unica lista.
// Usa useQueries com a mesma queryKey de usePresencasDoDia para reaproveitar
// o cache das telas de presenca.
export function usePresencasDaEdicao(
  edicaoId: string | undefined,
  dias: DiaFesta[]
): EstadoLista<PresencaRegistrada> {
  const resultados = useQueries({
    queries: dias.map((dia) => ({
      queryKey: ["presencas", "dia", dia.id],
      queryFn: () => listarPresencasDoDia(dia.id),
      enabled: !!edicaoId,
      refetchInterval: 60_000,
    })),
  });
  const itens = resultados.flatMap((r) => r.data ?? []);
  const carregando = resultados.some((r) => r.isLoading);
  const erro =
    resultados.map((r) => erroMsg(r.error)).find((e) => e !== null) ?? null;
  return { itens, carregando, erro };
}

// ─── Convites ─────────────────────────────────────────────────────────────────

export function useConvites(): EstadoLista<Convite> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["convites"],
    queryFn: () => api.get<Convite[]>("/api/convites"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Veiculos ────────────────────────────────────────────────────────────────

export function useVeiculos(): EstadoLista<VeiculoComPessoas> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["veiculos"],
    queryFn: () => api.get<VeiculoComPessoas[]>("/api/veiculos"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

export function useVeiculo(id: string | undefined): EstadoItem<Veiculo> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["veiculos", id],
    queryFn: () => api.get<Veiculo>(`/api/veiculos/${id}`),
    enabled: !!id,
  });
  return { item: data ?? null, carregando: isLoading && !!id, erro: erroMsg(error) };
}

export function useVeiculosPessoa(pessoaId: string | undefined): EstadoLista<Veiculo> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pessoas", pessoaId, "veiculos"],
    queryFn: () => api.get<Veiculo[]>(`/api/pessoas/${pessoaId}/veiculos`),
    enabled: !!pessoaId,
  });
  return { itens: data ?? [], carregando: isLoading && !!pessoaId, erro: erroMsg(error) };
}

export function useHistoricoEquipesPessoa(pessoaId: string | undefined): EstadoLista<HistoricoEquipePessoa> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pessoas", pessoaId, "historico-equipes"],
    queryFn: () => api.get<HistoricoEquipePessoa[]>(`/api/pessoas/${pessoaId}/historico-equipes`),
    enabled: !!pessoaId,
  });
  return { itens: data ?? [], carregando: isLoading && !!pessoaId, erro: erroMsg(error) };
}

export function useParentes(pessoaId: string | undefined): EstadoLista<Parentesco> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pessoas", pessoaId, "parentes"],
    queryFn: () => listarParentes(pessoaId as string),
    enabled: !!pessoaId,
  });
  return { itens: data ?? [], carregando: isLoading && !!pessoaId, erro: erroMsg(error) };
}

export function usePessoasVeiculo(veiculoId: string | undefined): EstadoLista<PessoaComVeiculos> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["veiculos", veiculoId, "pessoas"],
    queryFn: () => api.get<PessoaComVeiculos[]>(`/api/veiculos/${veiculoId}/pessoas`),
    enabled: !!veiculoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!veiculoId, erro: erroMsg(error) };
}

export function useVeiculosEstacionamento(estacionamentoId: string | undefined): EstadoLista<VeiculoComPessoas> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["estacionamentos", estacionamentoId, "veiculos"],
    queryFn: () => api.get<VeiculoComPessoas[]>(`/api/estacionamentos/${estacionamentoId}/veiculos`),
    enabled: !!estacionamentoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!estacionamentoId, erro: erroMsg(error) };
}

// ─── Estacionamentos ──────────────────────────────────────────────────────────

export function useEstacionamentos(): EstadoLista<Estacionamento> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["estacionamentos"],
    queryFn: () => api.get<Estacionamento[]>("/api/estacionamentos"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

export function useEstacionamento(id: string | undefined): EstadoItem<Estacionamento> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["estacionamentos", id],
    queryFn: () => api.get<Estacionamento>(`/api/estacionamentos/${id}`),
    enabled: !!id,
  });
  return { item: data ?? null, carregando: isLoading && !!id, erro: erroMsg(error) };
}

// ─── Vagas ─────────────────────────────────────────────────────────────────────

export function useVagas(): EstadoLista<Vaga> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vagas"],
    queryFn: () => api.get<Vaga[]>("/api/vagas"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

export function useVaga(id: string | undefined): EstadoItem<Vaga> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vagas", id],
    queryFn: () => api.get<Vaga>(`/api/vagas/${id}`),
    enabled: !!id,
  });
  return { item: data ?? null, carregando: isLoading && !!id, erro: erroMsg(error) };
}

export function useVagasEstacionamento(estacionamentoId: string | undefined): EstadoLista<Vaga> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vagas", "estacionamento", estacionamentoId],
    queryFn: () => api.get<Vaga[]>(`/api/vagas?estacionamentoId=${estacionamentoId}`),
    enabled: !!estacionamentoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!estacionamentoId, erro: erroMsg(error) };
}

export function useHistoricoVaga(vagaId: string | undefined): EstadoLista<HistoricoEstacionamentoVaga> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vagas", vagaId, "historico"],
    queryFn: () => api.get<HistoricoEstacionamentoVaga[]>(`/api/vagas/${vagaId}/historico`),
    enabled: !!vagaId,
  });
  return { itens: data ?? [], carregando: isLoading && !!vagaId, erro: erroMsg(error) };
}

// ─── Setores ──────────────────────────────────────────────────────────────────

export function useSetores(): EstadoLista<SetorInfo> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["setores"],
    queryFn: () => api.get<SetorInfo[]>("/api/setores"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Auditoria ────────────────────────────────────────────────────────────────

export function useAuditoriaRecente(qtd = 100): EstadoLista<EventoAuditoria> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["auditoria", qtd],
    queryFn: () => api.get<EventoAuditoria[]>(`/api/auditoria?qtd=${qtd}`),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

export function useCheckinPublico(token: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["checkin", "publico", token],
    queryFn: () => buscarEstacionamentoPublico(token!),
    enabled: !!token,
    retry: false,
  });
  return { estacionamento: data ?? null, carregando: isLoading && !!token, erro: erroMsg(error) };
}

export function useCheckinsEstacionamento(estacionamentoId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["checkins", estacionamentoId],
    queryFn: () => api.get<Checkin[]>(`/api/estacionamentos/${estacionamentoId}/checkins`),
    enabled: !!estacionamentoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!estacionamentoId, erro: erroMsg(error) };
}

export function useTodosCheckins(): EstadoLista<Checkin> {
  const { itens: estacionamentos } = useEstacionamentos();
  const ids = useMemo(
    () => estacionamentos.map((e) => e.id).sort(),
    [estacionamentos]
  );
  const { data, isLoading, error } = useQuery({
    queryKey: ["checkins", "todos", ids],
    queryFn: async () => {
      const resultados = await Promise.all(
        ids.map((id) => api.get<Checkin[]>(`/api/estacionamentos/${id}/checkins`))
      );
      return resultados.flat();
    },
    enabled: ids.length > 0,
  });
  return { itens: data ?? [], carregando: isLoading && ids.length > 0, erro: erroMsg(error) };
}

export function useHistoricoPublico(token: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["checkin", "historico", token],
    queryFn: () => buscarHistoricoPublico(token!),
    enabled: !!token,
    retry: false,
  });
  return { historico: data ?? null, carregando: isLoading && !!token, erro: erroMsg(error) };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useDashboardEstacionamentos() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "estacionamentos"],
    queryFn: () => api.get<DashboardInicial>("/api/estacionamentos/dashboard"),
  });
  return { dados: data ?? null, carregando: isLoading, erro: erroMsg(error) };
}

// ─── Avaliação de equipistas ──────────────────────────────────────────────────

export function useAvaliacaoLinkAtivo(edicaoId: string | undefined): EstadoItem<LinkAvaliacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["avaliacaoLink", edicaoId],
    queryFn: () => api.get<LinkAvaliacao>(`/api/avaliacao/links/${edicaoId}`),
    enabled: !!edicaoId,
  });
  return { item: data ?? null, carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

export function useAvaliacoes(
  edicaoId: string | undefined,
  filtros?: { equipeId?: string; status?: string }
): EstadoLista<Avaliacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["avaliacoes", edicaoId, filtros?.equipeId, filtros?.status],
    queryFn: () => {
      const params = new URLSearchParams({ edicaoId: edicaoId! });
      if (filtros?.equipeId) params.set("equipeId", filtros.equipeId);
      if (filtros?.status) params.set("status", filtros.status);
      return api.get<Avaliacao[]>(`/api/avaliacoes?${params.toString()}`);
    },
    enabled: !!edicaoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

export function useAvaliacoesPessoa(pessoaId: string | undefined): EstadoLista<Avaliacao> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["avaliacoes", "pessoa", pessoaId],
    queryFn: () => api.get<Avaliacao[]>(`/api/avaliacoes/pessoa/${pessoaId}`),
    enabled: !!pessoaId,
  });
  return { itens: data ?? [], carregando: isLoading && !!pessoaId, erro: erroMsg(error) };
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

export function useDebounce<T>(valor: T, atraso: number): T {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), atraso);
    return () => clearTimeout(timer);
  }, [valor, atraso]);
  return debounced;
}

function erroMsg(error: unknown): string | null {
  if (!error) return null;
  return (error as Error).message ?? "Falha ao carregar dados.";
}

// ─── Montagem de Equipes (022) ───────────────────────────────────────────────

const TAMANHO_LOTE_MONTAGEM = 20;

export function useMontagemCandidatos(
  edicaoId: string | undefined,
  equipeId: string | undefined
) {
  return useInfiniteQuery({
    queryKey: ["montagem-candidatos", edicaoId, equipeId],
    enabled: !!edicaoId && !!equipeId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listarCandidatosMontagem(edicaoId!, equipeId!, pageParam as number),
    getNextPageParam: (ultima, todas) =>
      ultima.temMais ? todas.length * TAMANHO_LOTE_MONTAGEM : undefined,
  });
}

// ─── Bloqueio de Pessoas (025) ───────────────────────────────────────────────

// Solicitacoes de bloqueio/desbloqueio. `status` opcional filtra a tela
// Bloqueios (Pendentes / Bloqueados); sem filtro, retorna tudo para o historico.
export function useBloqueios(
  args: { status?: StatusBloqueio } = {}
): EstadoLista<Bloqueio> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bloqueios", "status", args.status ?? "todos"],
    queryFn: () => listarBloqueios({ status: args.status }),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// Historico de uma pessoa (aba Bloqueios do box Exclusivo Pessoal e cards).
export function useBloqueiosDaPessoa(
  pessoaId: string | undefined
): EstadoLista<Bloqueio> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bloqueios", "pessoa", pessoaId],
    queryFn: () => listarBloqueios({ pessoaId: pessoaId as string }),
    enabled: !!pessoaId,
  });
  return {
    itens: data ?? [],
    carregando: isLoading && !!pessoaId,
    erro: erroMsg(error),
  };
}
