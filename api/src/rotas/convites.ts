import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function conviteDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const expiraEm = r.expira_em instanceof Date ? r.expira_em.toISOString() : String(r.expira_em ?? "");
  const usadoEm = r.usado_em instanceof Date
    ? r.usado_em.toISOString()
    : r.usado_em ? String(r.usado_em) : undefined;
  return {
    id: r.id,
    email: r.email,
    perfil: r.perfil,
    pessoaId: (r.pessoa_id as string | null) ?? undefined,
    equipesCRD: (r.equipes_crd as string[] | null) ?? undefined,
    status: r.status,
    criadoPorUid: r.criado_por_uid,
    criadoPorNome: r.criado_por_nome,
    criadoEm,
    expiraEm,
    usadoEm,
    usadoPorUid: (r.usado_por_uid as string | null) ?? undefined,
  };
}

// GET /api/convites
const getConvitesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Convites"],
  summary: "Lista convites",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de convites" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getConvitesRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const rows = await sql`SELECT * FROM convites ORDER BY criado_em DESC`;
  return c.json(rows.map(conviteDeRow) as any, 200);
});

// POST /api/convites
const postConviteRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Convites"],
  summary: "Cria convite",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});

app.openapi(postConviteRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { email, perfil, pessoaId, equipesCRD, token, expiraEm } = body;
  try {
    const [row] = await sql`
      INSERT INTO convites (id, email, perfil, pessoa_id, equipes_crd, status, criado_por_uid, criado_por_nome, expira_em)
      VALUES (
        ${String(token)}, ${String(email ?? "").toLowerCase()}, ${String(perfil ?? "EQP")},
        ${(pessoaId as string | null) ?? null},
        ${(equipesCRD as string[] | null) ?? null},
        'pendente', ${sessao.uid}, ${sessao.nome}, ${String(expiraEm ?? "")}
      ) RETURNING *
    `;
    await registrarEvento(sessao, "convite.gerou", `convites/${token}`, `${email} (${perfil})`);
    return c.json(conviteDeRow(row) as any, 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Token de convite duplicado. Tente novamente." }, 409);
    throw err;
  }
});

// PUT /api/convites/:id
const putConviteRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Convites"],
  summary: "Atualiza convite",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(putConviteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const [row] = await sql`
    UPDATE convites SET
      perfil      = ${String(body.perfil ?? "EQP")},
      pessoa_id   = ${(body.pessoaId as string | null) ?? null},
      equipes_crd = ${(body.equipesCRD as string[] | null) ?? null}
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Convite não encontrado." }, 404);
  await registrarEvento(sessao, "convite.atualizou", `convites/${id}`, String(body.perfil ?? ""));
  return c.json(conviteDeRow(row) as any, 200);
});

// PUT /api/convites/:id/revogar
const putConviteRevogarRoute = createRoute({
  method: "put",
  path: "/{id}/revogar",
  tags: ["Convites"],
  summary: "Revoga convite",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Revogado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(putConviteRevogarRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`UPDATE convites SET status = 'revogado' WHERE id = ${id} RETURNING email`;
  if (!row) return c.json({ erro: "Convite não encontrado." }, 404);
  await registrarEvento(sessao, "convite.revogou", `convites/${id}`, String(row.email));
  return c.json({ ok: true }, 200);
});

// DELETE /api/convites/:id
const deleteConviteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Convites"],
  summary: "Deleta convite",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Deletado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(deleteConviteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`DELETE FROM convites WHERE id = ${id} RETURNING email`;
  if (!row) return c.json({ erro: "Convite não encontrado." }, 404);
  await registrarEvento(sessao, "convite.removeu", `convites/${id}`, String(row.email));
  return c.json({ ok: true }, 200);
});

export default app;
