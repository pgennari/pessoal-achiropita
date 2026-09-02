import sql from "./db.js";
import type { Sessao } from "./tipos.js";

// Append-only: a API nunca faz UPDATE/DELETE nesta tabela.
export async function registrarEvento(
  sessao: Sessao | { uid: string; nome: string },
  acao: string,
  alvo: string,
  detalhes?: string
): Promise<void> {
  // Modo simulacao (031): even events executados sob simulacao ficam
  // creditados ao autor real (uid/nome), com a marca do perfil simulado.
  const marca = "perfil" in sessao && sessao.simulando
    ? `[simulacao perfil ${sessao.perfil}]`
    : null;
  const detalhesFinal = detalhes ?? null;
  const detalhesComMarca = marca
    ? `${detalhesFinal ?? ""} ${marca}`.trim()
    : detalhesFinal;
  await sql`
    INSERT INTO auditoria (id, acao, alvo, autor, autor_nome, detalhes, criado_em)
    VALUES (
      gen_random_uuid()::text,
      ${acao}, ${alvo}, ${sessao.uid}, ${"nome" in sessao ? sessao.nome : ""},
      ${detalhesComMarca}, NOW()
    )
  `;
}
