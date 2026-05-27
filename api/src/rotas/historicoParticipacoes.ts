import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
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
    equipeNome: String(r.equipe_nome ?? ""),
    funcao: r.funcao ? String(r.funcao) : null,
    criadoEm,
  };
}

// GET /api/historico-participacoes?pessoaId=:id
// Sem pessoaId retorna tudo (ADM/ORG) — usado na tela de Histórico.
app.get("/", comAuth, async (c) => {
  const pessoaId = c.req.query("pessoaId");
  if (pessoaId) {
    const rows = await sql`
      SELECT * FROM participacoes_historicas
      WHERE pessoa_id = ${pessoaId}
      ORDER BY edicao_numero DESC
    `;
    return c.json(rows.map(historicoDeRow));
  }
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const rows = await sql`
    SELECT * FROM participacoes_historicas
    ORDER BY edicao_numero DESC
  `;
  return c.json(rows.map(historicoDeRow));
});

export default app;
