import { api } from "./api";
import { queryClient } from "./queryClient";
import { Barraca, Setor } from "./tipos";
import { Sessao } from "./sessao";
import { normalizar } from "./utilsDominio";

export interface DadosBarracaForm {
  nome: string;
  setor: Setor;
  vagasCoordenador: number | undefined;
  vagasEquipista: number | undefined;
  vagasApoio: number | undefined;
}

export class ErroBarraca extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

export function barracaDeSnap(id: string, data: Record<string, unknown>): Barraca {
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
  d: DadosBarracaForm,
  existentes: Barraca[],
  excetoId?: string
): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.nome.trim()) erros.nome = "Nome é obrigatório.";
  else {
    const dup = existentes.find(
      (b) => b.id !== excetoId && normalizar(b.nome) === normalizar(d.nome)
    );
    if (dup) erros.nome = "Já existe uma barraca com este nome nesta edição.";
  }
  for (const chave of ["vagasCoordenador", "vagasEquipista", "vagasApoio"] as const) {
    const v = d[chave];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0)
      erros[chave] = "Valor inválido.";
  }
  return erros;
}

function invalidarBarracas(edicaoId?: string) {
  queryClient.invalidateQueries({ queryKey: ["barracas"] });
  if (edicaoId) queryClient.invalidateQueries({ queryKey: ["barracas", edicaoId] });
}

export async function criarBarraca(
  _sessao: Sessao,
  edicaoId: string,
  dados: DadosBarracaForm,
  existentes: Barraca[]
): Promise<string> {
  const erros = validar(dados, existentes);
  if (Object.keys(erros).length) throw new ErroBarraca(erros);

  const barraca = await api.post<Barraca>("/api/barracas", {
    ...dados,
    nome: dados.nome.trim(),
    edicaoId,
  });
  invalidarBarracas(edicaoId);
  return barraca.id as string;
}

export async function atualizarBarraca(
  _sessao: Sessao,
  barraca: Barraca,
  dados: DadosBarracaForm,
  existentes: Barraca[]
): Promise<void> {
  const erros = validar(dados, existentes, barraca.id);
  if (Object.keys(erros).length) throw new ErroBarraca(erros);

  await api.put(`/api/barracas/${barraca.id}`, { ...dados, nome: dados.nome.trim() });
  invalidarBarracas(barraca.edicaoId);
}

export async function copiarBarracasDeEdicao(
  _sessao: Sessao,
  edicaoOrigemId: string,
  edicaoDestinoId: string
): Promise<number> {
  const { copiadas } = await api.post<{ copiadas: number }>("/api/barracas/copiar", {
    edicaoOrigemId,
    edicaoDestinoId,
  });
  invalidarBarracas(edicaoDestinoId);
  return copiadas;
}

export async function removerBarraca(_sessao: Sessao, barraca: Barraca): Promise<void> {
  await api.delete(`/api/barracas/${barraca.id}`);
  invalidarBarracas(barraca.edicaoId);
  // Participações são removidas em cascade pelo banco.
  queryClient.invalidateQueries({ queryKey: ["participacoes"] });
}
