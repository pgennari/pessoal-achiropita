import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function parseCriterios(c: unknown): Record<string, string | null> {
  if (typeof c === "string") {
    try { return JSON.parse(c); } catch { return {}; }
  }
  if (c && typeof c === "object") return c as Record<string, string | null>;
  return {};
}

// ─── Gerar link de avaliação ────────────────────────────────────────────────

const postLinkRoute = createRoute({
  method: "post",
  path: "/links",
  tags: ["Avaliação"],
  summary: "Gerar link de avaliação para a edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(postLinkRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao avaliacao.gerenciar." }, 403);
  }
  const { edicaoId } = (await c.req.json()) as { edicaoId: string };

  // Revoga link ativo existente para a edição
  await sql`
    UPDATE links_avaliacao SET status = 'revogado'
    WHERE edicao_id = ${edicaoId} AND status = 'ativo'
  `;

  // Gera novo token e insere
  const token = crypto.randomUUID().replace(/-/g, "");
  const [row] = await sql`
    INSERT INTO links_avaliacao (id, edicao_id, status, criado_por_uid, criado_por_nome)
    VALUES (${token}, ${edicaoId}, 'ativo', ${sessao.uid}, ${sessao.nome})
    RETURNING *
  `;

  await registrarEvento(
    sessao, "avaliacaoLink.gerou", `links_avaliacao/${token}`,
    `edicao ${edicaoId}`
  );

  return c.json({
    id: row.id,
    edicaoId: row.edicao_id,
    status: row.status,
    criadoPorUid: row.criado_por_uid,
    criadoPorNome: row.criado_por_nome,
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em),
  }, 201);
});

// ─── Revogar link ───────────────────────────────────────────────────────────

const putRevogarRoute = createRoute({
  method: "put",
  path: "/links/{token}/revogar",
  tags: ["Avaliação"],
  summary: "Revogar link de avaliação",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ token: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Revogado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(putRevogarRoute, async (c) => {
  const { token } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao avaliacao.gerenciar." }, 403);
  }
  const [row] = await sql`
    UPDATE links_avaliacao SET status = 'revogado' WHERE id = ${token} RETURNING edicao_id
  `;
  if (!row) return c.json({ erro: "Link não encontrado." }, 404);
  await registrarEvento(sessao, "avaliacaoLink.revogou", `links_avaliacao/${token}`);
  return c.json({ ok: true }, 200);
});

// ─── Buscar link ativo da edição ────────────────────────────────────────────

const getLinkAtivoRoute = createRoute({
  method: "get",
  path: "/links/{edicaoId}",
  tags: ["Avaliação"],
  summary: "Buscar link ativo da edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ edicaoId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Link encontrado" },
    204: { description: "Nenhum link ativo" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getLinkAtivoRoute, async (c) => {
  const { edicaoId } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao avaliacao.gerenciar." }, 403);
  }
  const [row] = await sql`
    SELECT id, edicao_id, status, criado_em
    FROM links_avaliacao
    WHERE edicao_id = ${edicaoId} AND status = 'ativo'
    ORDER BY criado_em DESC LIMIT 1
  `;
  if (!row) return c.body(null, 204);
  return c.json({
    id: row.id,
    edicaoId: row.edicao_id,
    status: row.status,
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em),
  }, 200);
});

// ─── Listar avaliações da edição ────────────────────────────────────────────

const getAvaliacoesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Avaliação"],
  summary: "Listar avaliações da edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      edicaoId: z.string(),
      equipeId: z.string().optional(),
      status: z.enum(["rascunho", "finalizada"]).optional(),
    })
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de avaliações" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getAvaliacoesRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao avaliacao.gerenciar." }, 403);
  }
  const { edicaoId, equipeId, status } = c.req.valid("query");

  const rows = await sql`
    SELECT a.*, e.nome AS equipe_nome, p.nome AS pessoa_nome, p.cracha AS pessoa_cracha
    FROM avaliacoes a
    JOIN equipes e ON e.id = a.equipe_id
    JOIN pessoas p ON p.id = a.pessoa_id
    WHERE a.edicao_id = ${edicaoId}
      ${equipeId ? sql`AND a.equipe_id = ${equipeId}` : sql``}
      ${status ? sql`AND a.status = ${status}` : sql``}
    ORDER BY a.atualizado_em DESC
  `;

  return c.json(rows.map((r) => ({
    id: r.id,
    edicaoId: r.edicao_id,
    equipeId: r.equipe_id,
    equipeNome: r.equipe_nome,
    pessoaId: r.pessoa_id,
    pessoaNome: r.pessoa_nome,
    pessoaCracha: r.pessoa_cracha != null ? String(r.pessoa_cracha) : null,
    avaliadorCracha: r.avaliador_cracha,
    avaliadorNome: r.avaliador_nome,
    criterios: parseCriterios(r.criterios),
    aptoCoordenar: r.apto_coordenar,
    comentarios: r.comentarios,
    status: r.status,
    criadoEm: r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em),
    atualizadoEm: r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em),
    finalizadoEm: r.finalizado_em instanceof Date ? r.finalizado_em.toISOString() : (r.finalizado_em ? String(r.finalizado_em) : null),
  })) as any, 200);
});

// ─── Detalhes de uma avaliação ──────────────────────────────────────────────

const getAvaliacaoRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Avaliação"],
  summary: "Detalhes de uma avaliação",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Avaliação" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(getAvaliacaoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao avaliacao.gerenciar." }, 403);
  }
  const [row] = await sql`
    SELECT a.*, e.nome AS equipe_nome
    FROM avaliacoes a
    JOIN equipes e ON e.id = a.equipe_id
    WHERE a.id = ${id}
  `;
  if (!row) return c.json({ erro: "Avaliação não encontrada." }, 404);
  return c.json({
    id: row.id,
    edicaoId: row.edicao_id,
    equipeId: row.equipe_id,
    equipeNome: row.equipe_nome,
    pessoaId: row.pessoa_id,
    avaliadorCracha: row.avaliador_cracha,
    avaliadorNome: row.avaliador_nome,
    criterios: parseCriterios(row.criterios),
    aptoCoordenar: row.apto_coordenar,
    comentarios: row.comentarios,
    status: row.status,
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em),
    atualizadoEm: row.atualizado_em instanceof Date ? row.atualizado_em.toISOString() : String(row.atualizado_em),
    finalizadoEm: row.finalizado_em instanceof Date ? row.finalizado_em.toISOString() : (row.finalizado_em ? String(row.finalizado_em) : null),
  } as any, 200);
});

// ─── Avaliações por pessoa ──────────────────────────────────────────────────

const getAvaliacoesPessoaRoute = createRoute({
  method: "get",
  path: "/pessoa/{pessoaId}",
  tags: ["Avaliação"],
  summary: "Avaliações de uma pessoa em todas as edições",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ pessoaId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Avaliações da pessoa" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getAvaliacoesPessoaRoute, async (c) => {
  const { pessoaId } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar") && !temPermissao(sessao, "pessoas.detalhe")) {
    return c.json({ erro: "Acesso negado." }, 403);
  }
  const rows = await sql`
    SELECT a.*, e.nome AS equipe_nome, ed.numero AS edicao_numero
    FROM avaliacoes a
    JOIN equipes e ON e.id = a.equipe_id
    JOIN edicoes ed ON ed.id = a.edicao_id
    WHERE a.pessoa_id = ${pessoaId}
    ORDER BY a.atualizado_em DESC
  `;
  return c.json(rows.map((r) => ({
    id: r.id,
    edicaoId: r.edicao_id,
    edicaoNumero: r.edicao_numero,
    equipeId: r.equipe_id,
    equipeNome: r.equipe_nome,
    avaliadorCracha: r.avaliador_cracha,
    avaliadorNome: r.avaliador_nome,
    criterios: parseCriterios(r.criterios),
    aptoCoordenar: r.apto_coordenar,
    comentarios: r.comentarios,
    status: r.status,
    criadoEm: r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em),
    atualizadoEm: r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em),
    finalizadoEm: r.finalizado_em instanceof Date ? r.finalizado_em.toISOString() : (r.finalizado_em ? String(r.finalizado_em) : null),
  })) as any, 200);
});

// ─── Excluir uma avaliação ───────────────────────────────────────────────────

const deleteAvaliacaoRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Avaliação"],
  summary: "Excluir uma avaliação",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Excluída" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(deleteAvaliacaoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao avaliacao.gerenciar." }, 403);
  }
  const [row] = await sql`
    DELETE FROM avaliacoes WHERE id = ${id} RETURNING pessoa_id, edicao_id
  `;
  if (!row) return c.json({ erro: "Avaliação não encontrada." }, 404);
  await registrarEvento(
    sessao, "avaliacao.excluiu", `avaliacoes/${id}`,
    `pessoa ${row.pessoa_id} em edicao ${row.edicao_id}`
  );
  return c.json({ ok: true }, 200);
});

export default app;
