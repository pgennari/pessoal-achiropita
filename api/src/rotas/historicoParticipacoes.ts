import { Hono } from "hono";
import sql from "../db.js";
import { comAuth } from "../auth.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function historicoDeRow(r: Record<string, unknown>) {
  const criadoEm =
    r.criado_em instanceof Date
      ? r.criado_em.toISOString()
      : String(r.criado_em ?? "");
  return {
    id: String(r.id),
    pessoaId: String(r.pessoa_id ?? ""),
    pessoaNome: String(r.pessoa_nome ?? ""),
    edicaoNumero: Number(r.edicao_numero),
    barracaNome: String(r.barraca_nome ?? ""),
    funcao: r.funcao ? String(r.funcao) : null,
    criadoEm,
  };
}

// GET /api/historico-participacoes?pessoaId=:id
app.get("/", comAuth, async (c) => {
  const pessoaId = c.req.query("pessoaId");
  if (!pessoaId) return c.json({ erro: "pessoaId obrigatório." }, 400);
  const rows = await sql`
    SELECT * FROM participacoes_historicas
    WHERE pessoa_id = ${pessoaId}
    ORDER BY edicao_numero DESC
  `;
  return c.json(rows.map(historicoDeRow));
});

export default app;
