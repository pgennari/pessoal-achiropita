import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function equipeDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    nome: r.nome,
    setor: r.setor,
    vagasCoordenador: r.vagas_coordenador,
    vagasEquipista: r.vagas_equipista,
    vagasApoio: r.vagas_apoio,
    criadoEm,
    atualizadoEm,
  };
}

const getEquipesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Equipes"],
  summary: "Lista equipes",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de equipes" }
  }
});
app.openapi(getEquipesRoute, async (c) => {
  const sessao = c.get("sessao");
  const query = c.req.valid("query");
  const edicaoId = query.edicaoId;

  if (edicaoId) {
    const rows = await sql`SELECT * FROM equipes WHERE edicao_id = ${edicaoId} ORDER BY nome`;
    return c.json(rows.map(equipeDeRow) as any, 200);
  }

  if (sessao.perfil === "CRD" && sessao.equipesCRD?.length) {
    const rows = await sql`SELECT * FROM equipes WHERE id = ANY(${sessao.equipesCRD}) ORDER BY nome`;
    return c.json(rows.map(equipeDeRow) as any, 200);
  }

  const rows = await sql`SELECT * FROM equipes ORDER BY nome`;
  return c.json(rows.map(equipeDeRow) as any, 200);
});

const getEquipeIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Equipes"],
  summary: "Busca equipe por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Equipe" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(getEquipeIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await sql`SELECT * FROM equipes WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Equipe não encontrada." }, 404);
  return c.json(equipeDeRow(row) as any, 200);
});

const postEquipeRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Equipes"],
  summary: "Criar equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});
app.openapi(postEquipeRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { edicaoId, nome, setor, vagasCoordenador, vagasEquipista, vagasApoio } = body;
  const [row] = await sql`
    INSERT INTO equipes (edicao_id, nome, setor, vagas_coordenador, vagas_equipista, vagas_apoio)
    VALUES (
      ${String(edicaoId ?? "")}, ${String(nome ?? "")}, ${String(setor ?? "Interna")},
      ${Number(vagasCoordenador ?? 0)}, ${Number(vagasEquipista ?? 0)}, ${Number(vagasApoio ?? 0)}
    ) RETURNING *
  `;
  await registrarEvento(sessao, "equipe.criou", `equipes/${row.id}`, String(nome ?? ""));
  return c.json(equipeDeRow(row) as any, 201);
});

const putEquipeRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Equipes"],
  summary: "Atualizar equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(putEquipeRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { nome, setor, vagasCoordenador, vagasEquipista, vagasApoio } = body;
  const [row] = await sql`
    UPDATE equipes SET
      nome              = ${String(nome ?? "")},
      setor             = ${String(setor ?? "Interna")},
      vagas_coordenador = ${Number(vagasCoordenador ?? 0)},
      vagas_equipista   = ${Number(vagasEquipista ?? 0)},
      vagas_apoio       = ${Number(vagasApoio ?? 0)},
      atualizado_em     = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Equipe não encontrada." }, 404);
  await registrarEvento(sessao, "equipe.atualizou", `equipes/${id}`, String(nome ?? ""));
  return c.json(equipeDeRow(row) as any, 200);
});

const deleteEquipeRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Equipes"],
  summary: "Deletar equipe",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});
app.openapi(deleteEquipeRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`DELETE FROM equipes WHERE id = ${id} RETURNING nome`;
  if (!row) return c.json({ erro: "Equipe não encontrada." }, 404);
  await registrarEvento(sessao, "equipe.removeu", `equipes/${id}`, String(row.nome));
  return c.json({ ok: true }, 200);
});

const postEquipeCopiarRoute = createRoute({
  method: "post",
  path: "/copiar",
  tags: ["Equipes"],
  summary: "Copiar equipes de outra edição",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});
app.openapi(postEquipeCopiarRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const { edicaoOrigemId, edicaoDestinoId } = await c.req.json() as {
    edicaoOrigemId: string;
    edicaoDestinoId: string;
  };
  const result = await sql`
    INSERT INTO equipes (edicao_id, nome, setor, vagas_coordenador, vagas_equipista, vagas_apoio, criado_em, atualizado_em)
    SELECT ${edicaoDestinoId}, nome, setor, vagas_coordenador, vagas_equipista, vagas_apoio, NOW(), NOW()
    FROM equipes WHERE edicao_id = ${edicaoOrigemId}
    RETURNING id
  `;
  const copiadas = result.length;
  if (copiadas > 0) {
    await registrarEvento(
      sessao,
      "equipe.copiouEdicao",
      `equipes/edicao:${edicaoDestinoId}`,
      `${copiadas} equipe(s) copiada(s) de ${edicaoOrigemId}`
    );
  }
  return c.json({ copiadas }, 200);
});

export default app;
