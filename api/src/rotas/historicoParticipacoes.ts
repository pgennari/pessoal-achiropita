import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

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

const getHistoricoRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Histórico"],
  summary: "Lista histórico de participações",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ pessoaId: z.string().optional() })
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de histórico" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getHistoricoRoute, async (c) => {
  const query = c.req.valid("query");
  const pessoaId = query.pessoaId;
  if (pessoaId) {
    const rows = await sql`
      SELECT * FROM participacoes_historicas
      WHERE pessoa_id = ${pessoaId}
      ORDER BY edicao_numero DESC
    `;
    return c.json(rows.map(historicoDeRow) as any, 200);
  }
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const rows = await sql`
    SELECT * FROM participacoes_historicas
    ORDER BY edicao_numero DESC
  `;
  return c.json(rows.map(historicoDeRow) as any, 200);
});

export default app;
