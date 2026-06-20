// Hooks de leitura de dados — substituem o padrão onSnapshot do Firestore.
// Usa @tanstack/react-query: cache, loading state e refetch após mutações.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import {
  Convite,
  Edicao,
  EntregaCracha,
  Equipe,
  Estacionamento,
  EventoAuditoria,
  Formacao,
  LinkValidacao,
  Participacao,
  ParticipacaoHistorica,
  Pessoa,
  TurmaFormacao,
  Usuario,
} from "./tipos";

export interface EstadoLista<T> {
  itens: T[];
  carregando: boolean;
  erro: string | null;
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

// ─── Entregas de crachá ───────────────────────────────────────────────────────

export function useEntregasCracha(edicaoId: string | undefined): EstadoLista<EntregaCracha> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["entregas", edicaoId],
    queryFn: () => api.get<EntregaCracha[]>(`/api/entregas?edicaoId=${edicaoId}`),
    enabled: !!edicaoId,
  });
  return { itens: data ?? [], carregando: isLoading && !!edicaoId, erro: erroMsg(error) };
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

export function useUsuarios(): EstadoLista<Usuario> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => api.get<Usuario[]>("/api/usuarios"),
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

// ─── Convites ─────────────────────────────────────────────────────────────────

export function useConvites(): EstadoLista<Convite> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["convites"],
    queryFn: () => api.get<Convite[]>("/api/convites"),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
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

// ─── Auditoria ────────────────────────────────────────────────────────────────

export function useAuditoriaRecente(qtd = 100): EstadoLista<EventoAuditoria> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["auditoria", qtd],
    queryFn: () => api.get<EventoAuditoria[]>(`/api/auditoria?qtd=${qtd}`),
  });
  return { itens: data ?? [], carregando: isLoading, erro: erroMsg(error) };
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

function erroMsg(error: unknown): string | null {
  if (!error) return null;
  return (error as Error).message ?? "Falha ao carregar dados.";
}
