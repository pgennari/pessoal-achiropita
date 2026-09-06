import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
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
  if (!temPermissao(sessao, "usuario.lista")) {
    return c.json({ erro: "Acesso negado. Requer permissao usuario.lista." }, 403);
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
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});

app.openapi(postConviteRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "usuario.conviteEnviar")) {
    return c.json({ erro: "Acesso negado. Requer permissao usuario.conviteEnviar." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { email, perfil, equipesCRD, token, expiraEm } = body;
  const pessoaId = (body.pessoaId as string | null) ?? null;
  const emailNormalizado = String(email ?? "").trim().toLowerCase();

  if (!pessoaId) {
    return c.json({ erro: "O convite deve estar vinculado a uma Pessoa." }, 400);
  }
  const [pessoa] = await sql`SELECT id, email FROM pessoas WHERE id = ${pessoaId}`;
  if (!pessoa) {
    return c.json({ erro: "Pessoa vinculada não encontrada." }, 400);
  }
  const emailPessoa = String((pessoa.email as string | null) ?? "").trim().toLowerCase();
  if (!emailPessoa) {
    return c.json({ erro: "A pessoa selecionada não possui e-mail cadastrado." }, 400);
  }
  if (emailPessoa !== emailNormalizado) {
    return c.json({ erro: "O e-mail do convite deve ser o e-mail cadastrado da pessoa." }, 400);
  }

  const [usuario] = await sql`SELECT 1 FROM usuarios WHERE email = ${emailPessoa}`;
  if (usuario) {
    return c.json({ erro: "Já existe usuário cadastrado com este e-mail; edite o usuário em vez de gerar convite." }, 409);
  }
  const [pendente] = await sql`SELECT 1 FROM convites WHERE email = ${emailPessoa} AND status = 'pendente'`;
  if (pendente) {
    return c.json({ erro: "Já existe convite pendente para este e-mail." }, 409);
  }

  try {
    const [row] = await sql`
      INSERT INTO convites (id, email, perfil, pessoa_id, equipes_crd, status, criado_por_uid, criado_por_nome, expira_em)
      VALUES (
        ${String(token)}, ${emailPessoa}, ${String(perfil ?? "EQP")},
        ${pessoaId},
        ${(equipesCRD as string[] | null) ?? null},
        'pendente', ${sessao.uid}, ${sessao.nome}, ${String(expiraEm ?? "")}
      ) RETURNING *
    `;
    await registrarEvento(sessao, "convite.gerou", `convites/${token}`, `${emailPessoa} (${perfil})`);
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
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});

app.openapi(putConviteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "usuario.conviteEnviar")) {
    return c.json({ erro: "Acesso negado. Requer permissao usuario.conviteEnviar." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const pessoaId = (body.pessoaId as string | null) ?? null;

  if (!pessoaId) {
    return c.json({ erro: "O convite deve estar vinculado a uma Pessoa." }, 400);
  }
  const [pessoa] = await sql`SELECT id, email FROM pessoas WHERE id = ${pessoaId}`;
  if (!pessoa) {
    return c.json({ erro: "Pessoa vinculada não encontrada." }, 400);
  }
  const emailPessoa = String((pessoa.email as string | null) ?? "").trim().toLowerCase();
  if (!emailPessoa) {
    return c.json({ erro: "A pessoa selecionada não possui e-mail cadastrado." }, 400);
  }

  const [usuario] = await sql`SELECT 1 FROM usuarios WHERE email = ${emailPessoa}`;
  if (usuario) {
    return c.json({ erro: "Já existe usuário cadastrado com este e-mail; edite o usuário em vez de gerar convite." }, 409);
  }
  const [pendente] = await sql`SELECT 1 FROM convites WHERE email = ${emailPessoa} AND status = 'pendente' AND id <> ${id}`;
  if (pendente) {
    return c.json({ erro: "Já existe convite pendente para este e-mail." }, 409);
  }

  const [row] = await sql`
    UPDATE convites SET
      email       = ${emailPessoa},
      perfil      = ${String(body.perfil ?? "EQP")},
      pessoa_id   = ${pessoaId},
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
  if (!temPermissao(sessao, "usuario.conviteRevogar")) {
    return c.json({ erro: "Acesso negado. Requer permissao usuario.conviteRevogar." }, 403);
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
  if (!temPermissao(sessao, "usuario.excluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao usuario.excluir." }, 403);
  }
  const [row] = await sql`DELETE FROM convites WHERE id = ${id} RETURNING email`;
  if (!row) return c.json({ erro: "Convite não encontrado." }, 404);
  await registrarEvento(sessao, "convite.removeu", `convites/${id}`, String(row.email));
  return c.json({ ok: true }, 200);
});

export default app;
