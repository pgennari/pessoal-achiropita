import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function diaDeRow(r: Record<string, unknown>) {
  const data = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data ?? "");
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    data,
    criadoEm,
    atualizadoEm,
  };
}

const getDiasRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Dias de festa"],
  summary: "Lista dias de festa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de dias" }
  }
});

app.openapi(getDiasRoute, async (c) => {
  const query = c.req.valid("query");
  const edicaoId = query.edicaoId;
  if (edicaoId) {
    const rows = await sql`
      SELECT * FROM dias_festa WHERE edicao_id = ${edicaoId}
      ORDER BY data
    `;
    return c.json(rows.map(diaDeRow) as any, 200);
  }
  const rows = await sql`SELECT * FROM dias_festa ORDER BY data`;
  return c.json(rows.map(diaDeRow) as any, 200);
});

const postDiaRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Dias de festa"],
  summary: "Cria dia de festa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});

app.openapi(postDiaRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.editar." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { edicaoId, data } = body;

  let row: Record<string, unknown>;
  try {
    [row] = await sql`
      INSERT INTO dias_festa (edicao_id, data)
      VALUES (${String(edicaoId ?? "")}, ${String(data ?? "")})
      RETURNING *
    `;
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Este dia já está cadastrado nesta edição." }, 409);
    if (e.code === "23514" || e.code === "23503")
      return c.json({ erro: "Data inválida ou edição não encontrada." }, 400);
    throw err;
  }

  await registrarEvento(sessao, "diaFesta.criou", `diasFesta/${row.id}`, `${data}`);
  return c.json(diaDeRow(row) as any, 201);
});

const deleteDiaRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Dias de festa"],
  summary: "Remove dia de festa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(deleteDiaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "edicao.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao edicao.editar." }, 403);
  }
  const [row] = await sql`
    DELETE FROM dias_festa WHERE id = ${id} RETURNING data
  `;
  if (!row) return c.json({ erro: "Dia de festa não encontrado." }, 404);
  await registrarEvento(sessao, "diaFesta.removeu", `diasFesta/${id}`, `${row.data}`);
  return c.json({ ok: true }, 200);
});

export default app;
