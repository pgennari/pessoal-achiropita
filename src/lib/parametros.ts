import { api } from "./api";
import { queryClient } from "./queryClient";
import {
  CHAVE_PARAMETRO_PARENTESCO,
  Parametro,
  PARENTESCOS_PADRAO,
  ParParentesco,
} from "./tipos";
import { Sessao } from "./sessao";

export interface DadosParametroForm {
  chave: string;
  valor: string;
  descricao: string;
}

// Cria um parametro (POST /api/parametros). A chave e imutavel apos a
// criacao; o valor e texto livre (pode guardar JSON).
// Lê as opções de um parâmetro cujo valor é um JSON array de strings (ex.:
// "tamanho-camiseta-adulto"). Aceita também texto separado por vírgula ou
// quebra de linha. Retorna o fallback quando o parâmetro não existe, está
// inativo ou o valor não vira uma lista útil.
export function opcoesDoParametro(
  parametros: Parametro[],
  chave: string,
  padrao: string[]
): string[] {
  const parametro = parametros.find((p) => p.chave === chave && p.ativo);
  if (!parametro || !parametro.valor.trim()) return padrao;

  let opcoes: string[] = [];
  try {
    const dado = JSON.parse(parametro.valor);
    if (Array.isArray(dado)) {
      opcoes = dado
        .filter((i): i is string => typeof i === "string")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch {
    opcoes = parametro.valor
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return opcoes.length > 0 ? opcoes : padrao;
}

// Lê os pares de parentesco do parâmetro `parentesco` (JSON array de
// { parentesco-ida, parentesco-volta }). Retorna o fallback em código quando o
// parâmetro não existe, está inativo ou o valor não vira uma lista útil.
export function opcoesParentescoDoParametro(
  parametros: Parametro[]
): ParParentesco[] {
  const parametro = parametros.find(
    (p) => p.chave === CHAVE_PARAMETRO_PARENTESCO && p.ativo
  );
  if (!parametro || !parametro.valor.trim()) return PARENTESCOS_PADRAO;

  try {
    const dado: unknown = JSON.parse(parametro.valor);
    if (!Array.isArray(dado)) return PARENTESCOS_PADRAO;
    const pares: ParParentesco[] = [];
    for (const item of dado) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const ida = String(obj["parentesco-ida"] ?? "").trim();
      const volta = String(obj["parentesco-volta"] ?? "").trim();
      if (ida && volta) pares.push({ ida, volta });
    }
    return pares.length > 0 ? pares : PARENTESCOS_PADRAO;
  } catch {
    return PARENTESCOS_PADRAO;
  }
}

export async function criarParametro(
  _sessao: Sessao,
  dados: DadosParametroForm
): Promise<Parametro> {
  const criado = await api.post<Parametro>("/api/parametros", {
    chave: dados.chave.trim().toLowerCase(),
    valor: dados.valor,
    descricao: dados.descricao.trim(),
  });
  await queryClient.invalidateQueries({ queryKey: ["parametros"] });
  return criado;
}

// Atualiza valor/descricao/ativo de um parametro (PUT /api/parametros/:chave).
export async function atualizarParametro(
  _sessao: Sessao,
  chave: string,
  dados: { valor?: string; descricao?: string; ativo?: boolean }
): Promise<Parametro> {
  const atualizado = await api.put<Parametro>(`/api/parametros/${chave}`, {
    valor: dados.valor,
    descricao: dados.descricao?.trim(),
    ativo: dados.ativo,
  });
  await queryClient.invalidateQueries({ queryKey: ["parametros"] });
  return atualizado;
}
