import { api } from "./api";
import { queryClient } from "./queryClient";
import { Edicao, StatusEdicao } from "./tipos";
import { Sessao } from "./sessao";

export interface DadosEdicaoForm {
  numero: number | undefined;
  ano: number | undefined;
  inicio: string;
  fim: string;
  status: StatusEdicao;
}

export class ErroEdicao extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

// Mapper mantido para compatibilidade (alguns testes ou scripts podem usar).
export function edicaoDeSnap(id: string, data: Record<string, unknown>): Edicao {
  return {
    id,
    numero: (data.numero as number) ?? 0,
    ano: (data.ano as number) ?? 0,
    inicio: (data.inicio as string) ?? "",
    fim: (data.fim as string) ?? "",
    status: (data.status as StatusEdicao) ?? "planejamento",
    criadoEm: (data.criadoEm as string) || "",
    atualizadoEm: (data.atualizadoEm as string) || "",
  };
}

function validar(d: DadosEdicaoForm): Record<string, string> {
  const erros: Record<string, string> = {};
  if (typeof d.numero !== "number" || !Number.isInteger(d.numero) || d.numero <= 0)
    erros.numero = "Número da edição inválido.";
  if (typeof d.ano !== "number" || !Number.isInteger(d.ano) || d.ano < 1926 || d.ano > 2200)
    erros.ano = "Ano inválido.";
  if (!d.inicio) erros.inicio = "Data de início é obrigatória.";
  if (!d.fim) erros.fim = "Data de fim é obrigatória.";
  if (d.inicio && d.fim && d.inicio > d.fim)
    erros.fim = "Fim não pode ser antes do início.";
  return erros;
}

function invalidarEdicoes() {
  return queryClient.invalidateQueries({ queryKey: ["edicoes"] });
}

export async function criarEdicao(_sessao: Sessao, dados: DadosEdicaoForm): Promise<string> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroEdicao(erros);

  const edicao = await api.post<Edicao>("/api/edicoes", dados);
  await invalidarEdicoes();
  return edicao.id as string;
}

export async function atualizarEdicao(
  _sessao: Sessao,
  id: string,
  dados: DadosEdicaoForm
): Promise<void> {
  const erros = validar(dados);
  if (Object.keys(erros).length) throw new ErroEdicao(erros);

  await api.put(`/api/edicoes/${id}`, dados);
  await invalidarEdicoes();
}

export async function ativarEdicao(_sessao: Sessao, edicao: Edicao): Promise<void> {
  if (edicao.status === "ativa") return;
  await api.post(`/api/edicoes/${edicao.id}/ativar`);
  await invalidarEdicoes();
}

export async function encerrarEdicao(_sessao: Sessao, edicao: Edicao): Promise<void> {
  await api.post(`/api/edicoes/${edicao.id}/encerrar`);
  await invalidarEdicoes();
}
