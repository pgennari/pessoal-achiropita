import { api } from "./api";
import { queryClient } from "./queryClient";
import { Equipe, Setor } from "./tipos";
import { Sessao } from "./sessao";
import { normalizar } from "./utilsDominio";

export interface DadosEquipeForm {
  nome: string;
  setor: Setor;
}

export class ErroEquipe extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export function equipeDeSnap(id: string, data: Record<string, unknown>): Equipe {
  return {
    id,
    edicaoId: (data.edicaoId as string) ?? "",
    nome: (data.nome as string) ?? "",
    setor: (data.setor as Setor) ?? "Interna",
    vagasCoordenador: (data.vagasCoordenador as number) ?? 0,
    vagasEquipista: (data.vagasEquipista as number) ?? 0,
    vagasApoio: (data.vagasApoio as number) ?? 0,
    criadoEm: (data.criadoEm as string) || "",
    atualizadoEm: (data.atualizadoEm as string) || "",
  };
}

function validar(
  d: DadosEquipeForm,
  existentes: Equipe[],
  excetoId?: string
): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.nome.trim()) erros.nome = "Nome é obrigatório.";
  else {
    const dup = existentes.find(
      (e) => e.id !== excetoId && normalizar(e.nome) === normalizar(d.nome)
    );
    if (dup) erros.nome = "Já existe uma equipe com este nome nesta edição.";
  }
  return erros;
}

function invalidarEquipes(edicaoId?: string) {
  queryClient.invalidateQueries({ queryKey: ["equipes"] });
  if (edicaoId) queryClient.invalidateQueries({ queryKey: ["equipes", edicaoId] });
}

export async function criarEquipe(
  _sessao: Sessao,
  edicaoId: string,
  dados: DadosEquipeForm,
  existentes: Equipe[]
): Promise<string> {
  const erros = validar(dados, existentes);
  if (Object.keys(erros).length) throw new ErroEquipe(erros);

  const equipe = await api.post<Equipe>("/api/equipes", {
    ...dados,
    nome: dados.nome.trim(),
    edicaoId,
  });
  invalidarEquipes(edicaoId);
  return equipe.id as string;
}

export async function atualizarEquipe(
  _sessao: Sessao,
  equipe: Equipe,
  dados: DadosEquipeForm,
  existentes: Equipe[]
): Promise<void> {
  const erros = validar(dados, existentes, equipe.id);
  if (Object.keys(erros).length) throw new ErroEquipe(erros);

  await api.put(`/api/equipes/${equipe.id}`, { ...dados, nome: dados.nome.trim() });
  invalidarEquipes(equipe.edicaoId);
}

export async function copiarEquipesDeEdicao(
  _sessao: Sessao,
  edicaoOrigemId: string,
  edicaoDestinoId: string
): Promise<number> {
  const { copiadas } = await api.post<{ copiadas: number }>("/api/equipes/copiar", {
    edicaoOrigemId,
    edicaoDestinoId,
  });
  invalidarEquipes(edicaoDestinoId);
  return copiadas;
}

export async function removerEquipe(_sessao: Sessao, equipe: Equipe): Promise<void> {
  await api.delete(`/api/equipes/${equipe.id}`);
  invalidarEquipes(equipe.edicaoId);
  // Participações são removidas em cascade pelo banco.
  queryClient.invalidateQueries({ queryKey: ["participacoes"] });
}
