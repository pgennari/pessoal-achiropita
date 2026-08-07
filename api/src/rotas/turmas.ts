import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function turmaDeRow(r: Record<string, unknown>) {
  const data = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data ?? "");
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    data,
    horarioInicio: r.horario_inicio,
    horarioFim: (r.horario_fim as string | null) ?? undefined,
    local: r.local,
    capacidadeMaxima: r.capacidade_maxima,
    setorVinculo: (r.setor_vinculo as string | null) ?? undefined,
    equipeIdVinculo: (r.equipe_id_vinculo as string | null) ?? undefined,
    criadoEm,
    atualizadoEm,
  };
}

const getTurmasRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Turmas"],
  summary: "Lista turmas",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de turmas" }
  }
});

app.openapi(getTurmasRoute, async (c) => {
  const query = c.req.valid("query");
  const edicaoId = query.edicaoId;
  if (edicaoId) {
    const rows = await sql`
      SELECT * FROM turmas_formacao WHERE edicao_id = ${edicaoId}
      ORDER BY data, horario_inicio
    `;
    return c.json(rows.map(turmaDeRow) as any, 200);
  }
  const rows = await sql`SELECT * FROM turmas_formacao ORDER BY data, horario_inicio`;
  return c.json(rows.map(turmaDeRow) as any, 200);
});

const getTurmaRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Turmas"],
  summary: "Busca turma por id",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Turma" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(getTurmaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await sql`SELECT * FROM turmas_formacao WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Turma não encontrada." }, 404);
  return c.json(turmaDeRow(row) as any, 200);
});

const postTurmaRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Turmas"],
  summary: "Cria turma",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(postTurmaRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { edicaoId, data, horarioInicio, horarioFim, local, capacidadeMaxima, setorVinculo, equipeIdVinculo } = body;
  const [row] = await sql`
    INSERT INTO turmas_formacao (edicao_id, data, horario_inicio, horario_fim, local, capacidade_maxima, setor_vinculo, equipe_id_vinculo)
    VALUES (
      ${String(edicaoId ?? "")}, ${String(data ?? "")}, ${String(horarioInicio ?? "")},
      ${(horarioFim as string | null) ?? null}, ${String(local ?? "")},
      ${Number(capacidadeMaxima ?? 0)},
      ${(setorVinculo as string | null) ?? null},
      ${(equipeIdVinculo as string | null) ?? null}
    ) RETURNING *
  `;
  await registrarEvento(
    sessao, "turma.criou", `turmasFormacao/${row.id}`, `${data} ${horarioInicio}`
  );
  return c.json(turmaDeRow(row) as any, 201);
});

const putTurmaRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Turmas"],
  summary: "Atualiza turma",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(putTurmaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { data, horarioInicio, horarioFim, local, capacidadeMaxima, setorVinculo, equipeIdVinculo } = body;
  const [row] = await sql`
    UPDATE turmas_formacao SET
      data               = ${String(data ?? "")},
      horario_inicio     = ${String(horarioInicio ?? "")},
      horario_fim        = ${(horarioFim as string | null) ?? null},
      local              = ${String(local ?? "")},
      capacidade_maxima  = ${Number(capacidadeMaxima ?? 0)},
      setor_vinculo      = ${(setorVinculo as string | null) ?? null},
      equipe_id_vinculo  = ${(equipeIdVinculo as string | null) ?? null},
      atualizado_em      = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Turma não encontrada." }, 404);
  await registrarEvento(
    sessao, "turma.atualizou", `turmasFormacao/${id}`, `${data} ${horarioInicio}`
  );
  return c.json(turmaDeRow(row) as any, 200);
});

const deleteTurmaRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Turmas"],
  summary: "Deleta turma",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(deleteTurmaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  // Revoga links ativos antes de deletar (ON DELETE CASCADE remove os registros).
  await sql`UPDATE links_validacao SET status = 'revogado' WHERE turma_id = ${id} AND status = 'ativo'`;
  const [row] = await sql`
    DELETE FROM turmas_formacao WHERE id = ${id} RETURNING data, horario_inicio
  `;
  if (!row) return c.json({ erro: "Turma não encontrada." }, 404);
  await registrarEvento(
    sessao, "turma.removeu", `turmasFormacao/${id}`, `${row.data} ${row.horario_inicio}`
  );
  return c.json({ ok: true }, 200);
});

export default app;
