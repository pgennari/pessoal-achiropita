import { api } from "./api";
import { queryClient } from "./queryClient";
import { DiaFesta } from "./tipos";
import { Sessao } from "./sessao";

export interface DadosDiaFestaForm {
  data: string; // ISO YYYY-MM-DD
}

export class ErroDiaFesta extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>, msg = "Dados inválidos.") {
    super(msg);
    this.campos = campos;
  }
}

function validar(d: DadosDiaFestaForm, existentes: DiaFesta[]): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data))
    erros.data = "Data inválida.";
  else {
    const dup = existentes.find((x) => x.data === d.data);
    if (dup) erros.data = "Este dia já está cadastrado nesta edição.";
  }
  return erros;
}

function invalidarDias(edicaoId: string) {
  queryClient.invalidateQueries({ queryKey: ["dias-festa", edicaoId] });
}

export async function criarDiaFesta(
  _sessao: Sessao,
  edicaoId: string,
  dados: DadosDiaFestaForm,
  existentes: DiaFesta[]
): Promise<DiaFesta> {
  const erros = validar(dados, existentes);
  if (Object.keys(erros).length) throw new ErroDiaFesta(erros);

  const dia = await api.post<DiaFesta>("/api/dias-festa", { edicaoId, data: dados.data });
  invalidarDias(edicaoId);
  return dia;
}

export async function removerDiaFesta(_sessao: Sessao, dia: DiaFesta): Promise<void> {
  await api.delete(`/api/dias-festa/${dia.id}`);
  invalidarDias(dia.edicaoId);
}
