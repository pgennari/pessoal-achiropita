// PBAC: catalogo de permissoes e validacao unica de acesso.
// O catalogo vive na tabela `permissoes`; a funcao `pode()` e o unico ponto
// de decisao de autorizacao do sistema.

import type { PostgresError } from "postgres";
import sql from "./db.js";
import type { Permissao } from "./tipos.js";

export type Sql = typeof sql;

export function permissaoDeRow(r: Record<string, unknown>): Permissao {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    codigo: String(r.codigo),
    rotulo: String(r.rotulo),
    descricao: String(r.descricao ?? ""),
    ativo: !!r.ativo,
    criadoEm,
    atualizadoEm,
  };
}

// Lista o catalogo. Sem `todos`, retorna somente as permissoes ativas.
export async function listarPermissoes(
  db: Sql,
  todos = false
): Promise<Permissao[]> {
  const rows = todos
    ? await db`SELECT * FROM permissoes ORDER BY codigo`
    : await db`SELECT * FROM permissoes WHERE ativo = TRUE ORDER BY codigo`;
  return rows.map(permissaoDeRow) as unknown as Permissao[];
}

// Um codigo e valido para associacao apenas quando existe e esta ativo.
export async function codigoPermissaoAtivo(db: Sql, codigo: string): Promise<boolean> {
  const rows = await db`SELECT 1 FROM permissoes WHERE codigo = ${codigo} AND ativo = TRUE`;
  return rows.length > 0;
}

// Filtra uma lista para somente codigos validos e ativos do catalogo.
export async function apenasPermissoesAtivas(
  db: Sql,
  permissoes: string[]
): Promise<string[]> {
  const ativas = await listarPermissoes(db);
  const ativos = new Set(ativas.map((p) => p.codigo));
  return Array.from(new Set(permissoes)).filter((c) => ativos.has(c));
}

// Funcao unica de validacao de acesso. Um codigo desativado nunca concede
// acesso: a pre-condicao e que `sessao.permissoes` so contenha codigos ativos
// (filtro feito pelo comAuth no carregamento da sessao).
export interface SessaoMinima {
  perfil?: string;
  // Multiplos perfis (033): array de perfis associados ao usuario. Quando
  // ausente, cai para `[perfil]` (compatibilidade com sessoes legadas).
  perfis?: string[];
  permissoes?: string[];
}

export function pode(sessao: SessaoMinima | null | undefined, codigo: string): boolean {
  if (!sessao) return false;
  const perfis = sessao.perfis ?? (sessao.perfil ? [sessao.perfil] : []);
  if (perfis.includes("ADM")) return true;
  return (sessao.permissoes ?? []).includes(codigo);
}

export function ehADM(sessao: SessaoMinima | null | undefined): boolean {
  if (!sessao) return false;
  const perfis = sessao.perfis ?? (sessao.perfil ? [sessao.perfil] : []);
  return perfis.includes("ADM");
}

export function isErroDuplicado(e: unknown): boolean {
  return (e as PostgresError)?.code === "23505";
}
