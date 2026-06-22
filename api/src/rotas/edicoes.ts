import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function edicaoDeRow(r: Record<string, unknown>) {
  const inicio = r.inicio instanceof Date ? r.inicio.toISOString().slice(0, 10) : String(r.inicio ?? "");
  const fim = r.fim instanceof Date ? r.fim.toISOString().slice(0, 10) : String(r.fim ?? "");
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    numero: r.numero,
    ano: r.ano,
    inicio,
    fim,
    status: r.status,
    criadoEm,
    atualizadoEm,
  };
}

const getEdicoesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Edições"],
  summary: "Lista edições",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista" }
  }
});
app.openapi(getEdicoesRoute, async (c) => {
  const rows = await sql`SELECT * FROM edicoes ORDER BY ano DESC`;
  return c.json(rows.map(edicaoDeRow) as any, 200);
});

const getEdicaoAtivaRoute = createRoute({
  method: "get",
  path: "/ativa",
  tags: ["Edições"],
  summary: "Busca edição ativa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Edição" }
  }
});
app.openapi(getEdicaoAtivaRoute, async (c) => {
  const [row] = await sql`SELECT * FROM edicoes WHERE status = 'ativa' LIMIT 1`;
  return c.json((row ? edicaoDeRow(row) : null) as any, 200);
});

const getEdicaoIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Edições"],
  summary: "Busca edição por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Edição" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(getEdicaoIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await sql`SELECT * FROM edicoes WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Edição não encontrada." }, 404);
  return c.json(edicaoDeRow(row) as any, 200);
});

const postEdicaoRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Edições"],
  summary: "Cria edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});
app.openapi(postEdicaoRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { numero, ano, inicio, fim, status } = body;

  let row: Record<string, unknown>;
  try {
    if (status === "ativa") {
      const rows = await sql.begin(async (t) => {
        await t`UPDATE edicoes SET status = 'encerrada', atualizado_em = NOW() WHERE status = 'ativa'`;
        return t`
          INSERT INTO edicoes (numero, ano, inicio, fim, status)
          VALUES (${Number(numero)}, ${Number(ano)}, ${String(inicio)}, ${String(fim)}, ${String(status)})
          RETURNING *
        `;
      });
      row = rows[0] as Record<string, unknown>;
    } else {
      [row] = await sql`
        INSERT INTO edicoes (numero, ano, inicio, fim, status)
        VALUES (${Number(numero)}, ${Number(ano)}, ${String(inicio)}, ${String(fim)}, ${String(status ?? "planejamento")})
        RETURNING *
      `;
    }
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Já existe uma edição ativa." }, 409);
    throw err;
  }

  await registrarEvento(sessao, "edicao.criou", `edicoes/${row.id}`, `${numero}ª (${ano})`);
  return c.json(edicaoDeRow(row) as any, 201);
});

const putEdicaoRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Edições"],
  summary: "Atualiza edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }), body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});
app.openapi(putEdicaoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { numero, ano, inicio, fim, status } = body;

  let row: Record<string, unknown>;
  try {
    if (status === "ativa") {
      const rows = await sql.begin(async (t) => {
        await t`UPDATE edicoes SET status = 'encerrada', atualizado_em = NOW() WHERE status = 'ativa' AND id != ${id}`;
        return t`
          UPDATE edicoes SET
            numero = ${Number(numero)}, ano = ${Number(ano)},
            inicio = ${String(inicio)}, fim = ${String(fim)},
            status = 'ativa', atualizado_em = NOW()
          WHERE id = ${id} RETURNING *
        `;
      });
      row = rows[0] as Record<string, unknown>;
    } else {
      [row] = await sql`
        UPDATE edicoes SET
          numero = ${Number(numero)}, ano = ${Number(ano)},
          inicio = ${String(inicio)}, fim = ${String(fim)},
          status = ${String(status ?? "planejamento")}, atualizado_em = NOW()
        WHERE id = ${id} RETURNING *
      `;
    }
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Já existe uma edição ativa." }, 409);
    throw err;
  }

  if (!row) return c.json({ erro: "Edição não encontrada." }, 404);
  await registrarEvento(sessao, "edicao.atualizou", `edicoes/${id}`, `${numero}ª`);
  return c.json(edicaoDeRow(row) as any, 200);
});

const postEdicaoAtivarRoute = createRoute({
  method: "post",
  path: "/{id}/ativar",
  tags: ["Edições"],
  summary: "Ativa edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(postEdicaoAtivarRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql.begin(async (t) => {
    await t`UPDATE edicoes SET status = 'encerrada', atualizado_em = NOW() WHERE status = 'ativa'`;
    return t`UPDATE edicoes SET status = 'ativa', atualizado_em = NOW() WHERE id = ${id} RETURNING numero, ano`;
  });
  if (!row) return c.json({ erro: "Edição não encontrada." }, 404);
  await registrarEvento(sessao, "edicao.ativou", `edicoes/${id}`, `${row.numero}ª (${row.ano})`);
  return c.json({ ok: true }, 200);
});

const postEdicaoEncerrarRoute = createRoute({
  method: "post",
  path: "/{id}/encerrar",
  tags: ["Edições"],
  summary: "Encerra edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(postEdicaoEncerrarRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`
    UPDATE edicoes SET status = 'encerrada', atualizado_em = NOW()
    WHERE id = ${id} RETURNING numero, ano
  `;
  if (!row) return c.json({ erro: "Edição não encontrada." }, 404);
  await registrarEvento(sessao, "edicao.encerrou", `edicoes/${id}`, `${row.numero}ª (${row.ano})`);
  return c.json({ ok: true }, 200);
});

export default app;
