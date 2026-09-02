import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function usuarioDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  const perfis = ((r.perfis as string[] | null) ?? []).filter(Boolean);
  return {
    uid: r.uid,
    email: r.email,
    nome: r.nome,
    // Compat (033): `perfil` e o perfil primario (primeiro de `perfis`).
    perfil: perfis[0] ?? "EQP",
    perfis,
    pessoaId: (r.pessoa_id as string | null) ?? undefined,
    equipesCRD: (r.equipes_crd as string[] | null) ?? undefined,
    tokenConvite: (r.token_convite as string | null) ?? undefined,
    criadoEm,
    atualizadoEm,
  };
}

const getUsuariosRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Usuários"],
  summary: "Lista usuários",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de usuários" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getUsuariosRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "usuario.lista")) {
    return c.json({ erro: "Acesso negado. Requer permissao usuario.lista." }, 403);
  }
  const rows = await sql`SELECT * FROM usuarios ORDER BY nome`;
  return c.json(rows.map(usuarioDeRow) as any, 200);
});

const getUsuarioMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Usuários"],
  summary: "Perfil do usuário autenticado",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Usuário" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(getUsuarioMeRoute, async (c) => {
  const sessao = c.get("sessao");
  const [row] = await sql`SELECT * FROM usuarios WHERE uid = ${sessao.uid}`;
  if (!row) return c.json({ erro: "Usuário não encontrado." }, 404);
  // Reflete a sessao corrente (031): sob simulacao, os campos abaixo trazem o
  // perfil/equipes/permissoes simulados para a UI inteira espelhar a troca.
  return c.json({
    ...(usuarioDeRow(row) as object),
    perfil: sessao.perfil,
    perfis: sessao.perfis,
    pessoaId: sessao.pessoaId,
    equipesCRD: sessao.equipesCRD,
    permissoes: sessao.permissoes,
    simulando: sessao.simulando === true,
  } as any, 200);
});

const putUsuarioRoute = createRoute({
  method: "put",
  path: "/{uid}",
  tags: ["Usuários"],
  summary: "Atualiza usuário",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ uid: z.string() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizado" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Necessário ao menos um perfil" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(putUsuarioRoute, async (c) => {
  const { uid } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "usuario.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao usuario.editar." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const perfisBrutos = Array.isArray(body.perfis) ? (body.perfis as unknown[]) : [];
  const perfis = Array.from(
    new Set(perfisBrutos.map((p) => String(p).trim()).filter((p) => p.length > 0))
  );
  if (perfis.length === 0) {
    return c.json({ erro: "Usuário precisa de pelo menos um perfil." }, 400);
  }
  const [row] = await sql`
    UPDATE usuarios SET
      email         = ${String(body.email ?? "")},
      nome          = ${String(body.nome ?? "")},
      perfis        = ${perfis as string[]},
      pessoa_id     = ${(body.pessoaId as string | null) ?? null},
      equipes_crd   = ${(body.equipesCRD as string[] | null) ?? null},
      atualizado_em = NOW()
    WHERE uid = ${uid} RETURNING *
  `;
  if (!row) return c.json({ erro: "Usuário não encontrado." }, 404);
  await registrarEvento(sessao, "usuario.atualizou", `usuarios/${uid}`, `${body.nome} (${perfis.join(", ")})`);
  return c.json(usuarioDeRow(row) as any, 200);
});

const deleteUsuarioRoute = createRoute({
  method: "delete",
  path: "/{uid}",
  tags: ["Usuários"],
  summary: "Remove usuário",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ uid: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Operação inválida" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(deleteUsuarioRoute, async (c) => {
  const { uid } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "usuario.excluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao usuario.excluir." }, 403);
  }
  if (uid === sessao.uid) {
    return c.json({ erro: "Não é possível remover seu próprio usuário." }, 400);
  }
  const [row] = await sql`DELETE FROM usuarios WHERE uid = ${uid} RETURNING nome, email`;
  if (!row) return c.json({ erro: "Usuário não encontrado." }, 404);
  await registrarEvento(sessao, "usuario.removeu", `usuarios/${uid}`, `${row.nome} (${row.email})`);
  return c.json({ ok: true }, 200);
});

export default app;
