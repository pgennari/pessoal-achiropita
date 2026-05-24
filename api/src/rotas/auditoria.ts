import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function eventoDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  return {
    id: r.id,
    acao: r.acao,
    alvo: r.alvo,
    autor: r.autor,
    autorNome: r.autor_nome,
    detalhes: (r.detalhes as string | null) ?? undefined,
    criadoEm,
  };
}

// GET /api/auditoria?qtd=100
app.get("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const qtd = Math.min(Number(c.req.query("qtd") ?? 100), 500);
  const rows = await sql`
    SELECT * FROM auditoria ORDER BY criado_em DESC LIMIT ${qtd}
  `;
  return c.json(rows.map(eventoDeRow));
});

export default app;
