// Rotas internas do fluxo de avaliação de coordenadores pelo equipista
// (028-avaliacao-equipista-coordenador). Exigem Firebase Auth + permissao
// avaliacao.gerenciar (ADM/ORG). Espelham o padrao de
// api/src/rotas/avaliacaoCoordenador.ts (027). O link é uma função da edição
// (token = ano da edicao em texto); um link ativo por edicao (o novo revoga o
// anterior). A avaliacao persistida ja esta finalizada (sem rascunho).
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

// ─── Gerar link público da edição ─────────────────────────────────────────────

const postLinkRoute = createRoute({
  method: "post",
  path: "/links",
  tags: ["Avaliação de coordenadores pelo equipista"],
  summary: "Gerar link público de avaliação de coordenadores pelo equipista",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    422: { content: { "application/json": { schema: z.any() } }, description: "Edição inválida" }
  }
});

app.openapi(postLinkRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao avaliacao.gerenciar." }, 403);
  }
  const { edicaoId } = (await c.req.json()) as { edicaoId: string };

  const [edicao] = await sql`
    SELECT ano FROM edicoes WHERE id = ${edicaoId}
  `;
  if (!edicao) {
    return c.json({ erro: "Edição não encontrada." }, 422);
  }
  if (!edicao.ano) {
    return c.json({ erro: "Edição sem ano definido." }, 422);
  }
  const token = String(edicao.ano);

  // Revoga o link ativo anterior da mesma edição (um ativo por edição).
  await sql`
    UPDATE links_avaliacao_equipista SET status = 'revogado'
    WHERE edicao_id = ${edicaoId} AND status = 'ativo'
  `;

  const [row] = await sql`
    INSERT INTO links_avaliacao_equipista (id, edicao_id, status, criado_por_uid, criado_por_nome)
    VALUES (${token}, ${edicaoId}, 'ativo', ${sessao.uid}, ${sessao.nome})
    RETURNING *
  `;

  await registrarEvento(
    sessao, "avaliacaoEquipistaLink.gerou", `links_avaliacao_equipista/${token}`,
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
  path: "/links/{id}/revogar",
  tags: ["Avaliação de coordenadores pelo equipista"],
  summary: "Revogar link público de avaliação de coordenadores pelo equipista",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Revogado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(putRevogarRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "avaliacao.gerenciar")) {
    return c.json({ erro: "Acesso negado. Requer permissao avaliacao.gerenciar." }, 403);
  }
  const [row] = await sql`
    UPDATE links_avaliacao_equipista SET status = 'revogado'
    WHERE id = ${id} RETURNING edicao_id
  `;
  if (!row) return c.json({ erro: "Link não encontrado." }, 404);
  await registrarEvento(sessao, "avaliacaoEquipistaLink.revogou", `links_avaliacao_equipista/${id}`);
  return c.json({ ok: true }, 200);
});

// ─── Buscar link ativo da edição ────────────────────────────────────────────

const getLinkAtivoRoute = createRoute({
  method: "get",
  path: "/links/{edicaoId}",
  tags: ["Avaliação de coordenadores pelo equipista"],
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
    FROM links_avaliacao_equipista
    WHERE edicao_id = ${edicaoId} AND status = 'ativo'
    LIMIT 1
  `;
  if (!row) return c.body(null, 204);
  return c.json({
    id: row.id,
    edicaoId: row.edicao_id,
    status: row.status,
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em),
  }, 200);
});

// ─── Listar avaliações de coordenadores pelo equipista da edição ──────────────

function avaliacaoDeRow(r: Record<string, unknown>) {
  let criterios = {};
  if (r.criterios && typeof r.criterios === "object") {
    criterios = r.criterios as Record<string, unknown>;
  } else if (typeof r.criterios === "string") {
    try {
      criterios = JSON.parse(r.criterios);
    } catch {
      criterios = {};
    }
  }
  return {
    id: String(r.id),
    edicaoId: String(r.edicao_id),
    edicaoNumero: r.edicao_numero != null ? Number(r.edicao_numero) : undefined,
    equipeId: String(r.equipe_id),
    equipeNome: r.equipe_nome != null ? String(r.equipe_nome) : undefined,
    pessoaId: String(r.pessoa_id),
    pessoaNome: r.pessoa_nome != null ? String(r.pessoa_nome) : undefined,
    pessoaCracha: r.pessoa_cracha != null ? String(r.pessoa_cracha) : undefined,
    avaliadorPessoaId: String(r.avaliador_pessoa_id),
    avaliadorCracha: r.avaliador_cracha != null ? Number(r.avaliador_cracha) : null,
    avaliadorNome: r.avaliador_nome != null ? String(r.avaliador_nome) : "",
    criterios,
    comentarios: r.comentarios != null ? String(r.comentarios) : null,
    status: String(r.status),
    criadoEm: r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em),
    atualizadoEm: r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em),
    finalizadoEm: r.finalizado_em instanceof Date ? r.finalizado_em.toISOString() : (r.finalizado_em ? String(r.finalizado_em) : null),
  };
}

const getAvaliacoesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Avaliação de coordenadores pelo equipista"],
  summary: "Listar avaliações de coordenadores pelo equipista da edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      edicaoId: z.string(),
      equipeId: z.string().optional(),
      avaliadorPessoaId: z.string().optional(),
      status: z.enum(["finalizada"]).optional(),
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
  const { edicaoId, equipeId, avaliadorPessoaId, status } = c.req.valid("query");

  const rows = await sql`
    SELECT a.*, e.nome AS equipe_nome, p.nome AS pessoa_nome,
           p.cracha AS pessoa_cracha
    FROM avaliacoes_equipista_coordenador a
    JOIN equipes e ON e.id = a.equipe_id
    JOIN pessoas p ON p.id = a.pessoa_id
    WHERE a.edicao_id = ${edicaoId}
      ${equipeId ? sql`AND a.equipe_id = ${equipeId}` : sql``}
      ${avaliadorPessoaId ? sql`AND a.avaliador_pessoa_id = ${avaliadorPessoaId}` : sql``}
      ${status ? sql`AND a.status = ${status}` : sql``}
    ORDER BY a.atualizado_em DESC
  `;

  return c.json(rows.map((r) => avaliacaoDeRow(r as Record<string, unknown>)) as any, 200);
});

// ─── Avaliações de coordenador pelo equipista por pessoa ──────────────────────
// Histórico no detalhe da Pessoa: avaliações recebidas pela pessoa como
// coordenador da própria equipe, em todas as edições.

const getAvaliacoesPessoaRoute = createRoute({
  method: "get",
  path: "/pessoa/{pessoaId}",
  tags: ["Avaliação de coordenadores pelo equipista"],
  summary: "Avaliações de coordenador recebidas por uma pessoa em todas as edições",
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
    SELECT a.*, e.nome AS equipe_nome, p.nome AS pessoa_nome,
           p.cracha AS pessoa_cracha, ed.numero AS edicao_numero
    FROM avaliacoes_equipista_coordenador a
    JOIN equipes e ON e.id = a.equipe_id
    JOIN pessoas p ON p.id = a.pessoa_id
    JOIN edicoes ed ON ed.id = a.edicao_id
    WHERE a.pessoa_id = ${pessoaId}
    ORDER BY a.atualizado_em DESC
  `;
  return c.json(rows.map((r) => avaliacaoDeRow(r as Record<string, unknown>)) as any, 200);
});

// ─── Detalhes de uma avaliação ─────────────────────────────────────────────────

const getAvaliacaoRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Avaliação de coordenadores pelo equipista"],
  summary: "Detalhes de uma avaliação de coordenador pelo equipista",
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
    SELECT a.*, e.nome AS equipe_nome, p.nome AS pessoa_nome,
           p.cracha AS pessoa_cracha
    FROM avaliacoes_equipista_coordenador a
    JOIN equipes e ON e.id = a.equipe_id
    JOIN pessoas p ON p.id = a.pessoa_id
    WHERE a.id = ${id}
  `;
  if (!row) return c.json({ erro: "Avaliação não encontrada." }, 404);
  return c.json(avaliacaoDeRow(row as Record<string, unknown>) as any, 200);
});

// ─── Excluir uma avaliação ─────────────────────────────────────────────────────

const deleteAvaliacaoRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Avaliação de coordenadores pelo equipista"],
  summary: "Excluir uma avaliação de coordenador pelo equipista",
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
    DELETE FROM avaliacoes_equipista_coordenador WHERE id = ${id} RETURNING pessoa_id, edicao_id
  `;
  if (!row) return c.json({ erro: "Avaliação não encontrada." }, 404);
  await registrarEvento(
    sessao, "avaliacaoEquipista.excluiu", `avaliacoes_equipista_coordenador/${id}`,
    `pessoa ${row.pessoa_id} em edicao ${row.edicao_id}`
  );
  return c.json({ ok: true }, 200);
});

export default app;
