import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

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

const getAuditoriaRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Auditoria"],
  summary: "Lista eventos de auditoria",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ qtd: z.string().optional() })
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de eventos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});
app.openapi(getAuditoriaRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const query = c.req.valid("query");
  const qtd = Math.min(Number(query.qtd ?? "100"), 500);
  const rows = await sql`SELECT * FROM auditoria ORDER BY criado_em DESC LIMIT ${qtd}`;
  return c.json(rows.map(eventoDeRow) as any, 200);
});

export default app;
