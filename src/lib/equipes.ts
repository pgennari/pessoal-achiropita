import { api } from "./api";
import { queryClient } from "./queryClient";
import { Equipe, Setor, TipoEquipe, TIPO_EQUIPE_PADRAO } from "./tipos";
import { Sessao } from "./sessao";
import { normalizar } from "./utilsDominio";

export interface DadosEquipeForm {
  nome: string;
  setor: Setor;
  // Tipo de equipe: SUPERVISAO, APOIO ou NORMAL.
  tipo: TipoEquipe;
  // Equipe superior no organograma; null/undefined = equipe raiz.
  equipePaiId?: string | null;
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
    tipo: (data.tipo as TipoEquipe) ?? TIPO_EQUIPE_PADRAO,
    equipePaiId: (data.equipePaiId as string | null) ?? null,
    raiz: (data.raiz as boolean) ?? false,
    excluida: (data.excluida as boolean) ?? false,
    vagasCoordenador: (data.vagasCoordenador as number) ?? 0,
    vagasEquipista: (data.vagasEquipista as number) ?? 0,
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
  if (d.equipePaiId) {
    const pai = existentes.find((e) => e.id === d.equipePaiId);
    if (!pai) erros.equipePaiId = "Equipe superior não encontrada.";
    else if (pai.id === excetoId)
      erros.equipePaiId = "Uma equipe não pode ser subordinada a si mesma.";
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
    equipePaiId: dados.equipePaiId || null,
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

  await api.put(`/api/equipes/${equipe.id}`, {
    ...dados,
    nome: dados.nome.trim(),
    equipePaiId: dados.equipePaiId || null,
  });
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
  // Exclusao logica: o backend desaloca as pessoas e marca a equipe como
  // excluida; nada depende do cascade do banco.
  queryClient.invalidateQueries({ queryKey: ["participacoes"] });
}

// Muda apenas a subordinacao da equipe no organograma, preservando nome e
// setor. Nao usa a lista local de equipes (que pode estar desatualizada,
// ex.: pai recem-criado); a validacao de pai e ciclo fica no backend.
export async function definirEquipePai(
  _sessao: Sessao,
  equipe: Equipe,
  equipePaiId: string | null
): Promise<void> {
  await api.put(`/api/equipes/${equipe.id}`, {
    nome: equipe.nome,
    setor: equipe.setor,
    equipePaiId,
  });
  invalidarEquipes(equipe.edicaoId);
}

// Define/remove a marcacao de equipe raiz do organograma (unica por edicao;
// o backend desmarca as demais). Preserva nome, setor e equipe superior.
export async function definirEquipeRaiz(
  _sessao: Sessao,
  equipe: Equipe,
  raiz: boolean
): Promise<void> {
  await api.put(`/api/equipes/${equipe.id}`, {
    nome: equipe.nome,
    setor: equipe.setor,
    raiz,
  });
  invalidarEquipes(equipe.edicaoId);
}

// ─── Organograma (hierarquia de equipes) ─────────────────────────────────────

// No da arvore do organograma: equipe + subequipes + nivel na hierarquia.
export interface NoEquipe {
  equipe: Equipe;
  filhos: NoEquipe[];
  profundidade: number;
}

function ordenarPorNome(equipes: Equipe[]): Equipe[] {
  return [...equipes].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
  );
}

// Monta a arvore do organograma. Pai inexistente ou em ciclo vira raiz,
// para nenhuma equipe desaparecer da visao.
export function arvoreEquipes(equipes: Equipe[]): NoEquipe[] {
  const porId = new Map(equipes.map((e) => [e.id, e]));
  const filhosPorPai = new Map<string, Equipe[]>();
  const raizes: Equipe[] = [];
  for (const e of equipes) {
    const pai = e.equipePaiId && porId.has(e.equipePaiId) ? e.equipePaiId : null;
    if (pai) {
      const lista = filhosPorPai.get(pai) ?? [];
      lista.push(e);
      filhosPorPai.set(pai, lista);
    } else {
      raizes.push(e);
    }
  }

  const nos: NoEquipe[] = [];
  const visitados = new Set<string>();
  function montar(equipe: Equipe, profundidade: number): NoEquipe {
    visitados.add(equipe.id);
    const filhos = ordenarPorNome(filhosPorPai.get(equipe.id) ?? [])
      .filter((f) => !visitados.has(f.id))
      .map((f) => montar(f, profundidade + 1));
    return { equipe, filhos, profundidade };
  }
  for (const raiz of ordenarPorNome(raizes)) nos.push(montar(raiz, 0));
  // Ciclos remanescentes entram como raizes para continuar visiveis.
  for (const e of ordenarPorNome(equipes)) {
    if (!visitados.has(e.id)) nos.push(montar(e, 0));
  }
  return nos;
}

// Ids da propria equipe + todas as descendentes (para nao permitir escolher
// um pai que crie ciclo no formulario).
export function idsDescendentes(equipes: Equipe[], raizId: string): Set<string> {
  const filhosPorPai = new Map<string, string[]>();
  for (const e of equipes) {
    if (!e.equipePaiId) continue;
    const lista = filhosPorPai.get(e.equipePaiId) ?? [];
    lista.push(e.id);
    filhosPorPai.set(e.equipePaiId, lista);
  }
  const ids = new Set<string>([raizId]);
  const fila = [raizId];
  while (fila.length) {
    const atual = fila.pop() as string;
    for (const filho of filhosPorPai.get(atual) ?? []) {
      if (!ids.has(filho)) {
        ids.add(filho);
        fila.push(filho);
      }
    }
  }
  return ids;
}
