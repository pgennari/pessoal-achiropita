import sql from "./db.js";
import type { Sessao } from "./tipos.js";

// Append-only: a API nunca faz UPDATE/DELETE nesta tabela.
export async function registrarEvento(
  sessao: Sessao | { uid: string; nome: string },
  acao: string,
  alvo: string,
  detalhes?: string
): Promise<void> {
  await sql`
    INSERT INTO auditoria (id, acao, alvo, autor, autor_nome, detalhes, criado_em)
    VALUES (
      gen_random_uuid()::text,
      ${acao}, ${alvo}, ${sessao.uid}, ${"nome" in sessao ? sessao.nome : ""},
      ${detalhes ?? null}, NOW()
    )
  `;
}
