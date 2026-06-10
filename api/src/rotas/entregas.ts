import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function entregaDeRow(r: Record<string, unknown>) {
  const entregueEm = r.entregue_em instanceof Date ? r.entregue_em.toISOString() : String(r.entregue_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    pessoaId: r.pessoa_id,
    entregueEm,
    operadorUid: r.operador_uid,
    operadorNome: r.operador_nome,
    observacao: (r.observacao as string | null) ?? undefined,
  };
}

function idEntrega(edicaoId: string, pessoaId: string): string {
  return `${edicaoId}__${pessoaId}`;
}

const getEntregasRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Entregas"],
  summary: "Lista entregas",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de entregas" }
  }
});

app.openapi(getEntregasRoute, async (c) => {
  const query = c.req.valid("query");
  const edicaoId = query.edicaoId;
  if (edicaoId) {
    const rows = await sql`SELECT * FROM entregas_cracha WHERE edicao_id = ${edicaoId}`;
    return c.json(rows.map(entregaDeRow) as any, 200);
  }
  const rows = await sql`SELECT * FROM entregas_cracha`;
  return c.json(rows.map(entregaDeRow) as any, 200);
});

const postEntregaRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Entregas"],
  summary: "Marcar crachá como entregue",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});

app.openapi(postEntregaRoute, async (c) => {
  const sessao = c.get("sessao");
  const body = await c.req.json() as {
    edicaoId: string;
    pessoaId: string;
    pessoaNome: string;
    cracha: number;
    observacao?: string;
  };

  const id = idEntrega(body.edicaoId, body.pessoaId);
  try {
    const [row] = await sql`
      INSERT INTO entregas_cracha (id, edicao_id, pessoa_id, operador_uid, operador_nome, observacao)
      VALUES (
        ${id}, ${body.edicaoId}, ${body.pessoaId},
        ${sessao.uid}, ${sessao.nome}, ${body.observacao ?? null}
      ) RETURNING *
    `;
    await registrarEvento(
      sessao, "cracha.entregou", `entregasCracha/${id}`,
      `${body.pessoaNome} (#${body.cracha})`
    );
    return c.json(entregaDeRow(row) as any, 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      return c.json({ erro: "Crachá já foi marcado como entregue. ADM pode desbloquear para reposição." }, 409);
    }
    throw err;
  }
});

const deleteEntregaRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Entregas"],
  summary: "Desbloquear entrega (ADM only)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(deleteEntregaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as { pessoaNome?: string; cracha?: number };
  const [row] = await sql`DELETE FROM entregas_cracha WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ erro: "Entrega não encontrada." }, 404);
  await registrarEvento(
    sessao, "cracha.desbloqueou", `entregasCracha/${id}`,
    body.pessoaNome ? `${body.pessoaNome} (#${body.cracha})` : id
  );
  return c.json({ ok: true }, 200);
});

export default app;
