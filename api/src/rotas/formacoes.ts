import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function formacaoDeRow(r: Record<string, unknown>) {
  const presencaEm = r.presenca_em instanceof Date ? r.presenca_em.toISOString() : String(r.presenca_em ?? "");
  const validadoEm = r.validado_em instanceof Date
    ? r.validado_em.toISOString()
    : r.validado_em ? String(r.validado_em) : undefined;
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    pessoaId: r.pessoa_id,
    turmaId: (r.turma_id as string | null) ?? undefined,
    presencaTipo: r.presenca_tipo,
    presencaEm,
    registradoPorUid: r.registrado_por_uid,
    registradoPorNome: r.registrado_por_nome,
    justificativa: (r.justificativa as string | null) ?? undefined,
    dadosValidados: Boolean(r.dados_validados),
    validadoEm,
  };
}

function idFormacao(edicaoId: string, pessoaId: string): string {
  return `${edicaoId}__${pessoaId}`;
}

const getFormacoesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Formações"],
  summary: "Lista formações",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de formações" }
  }
});

app.openapi(getFormacoesRoute, async (c) => {
  const { edicaoId } = c.req.valid("query");
  if (edicaoId) {
    const rows = await sql`SELECT * FROM formacoes WHERE edicao_id = ${edicaoId}`;
    return c.json(rows.map(formacaoDeRow) as any, 200);
  }
  const rows = await sql`SELECT * FROM formacoes`;
  return c.json(rows.map(formacaoDeRow) as any, 200);
});

const postFormacaoRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Formações"],
  summary: "Marcar presença manual",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: z.any() } }, description: "Conflito" }
  }
});

app.openapi(postFormacaoRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "formacao.marcarManual")) {
    return c.json({ erro: "Acesso negado. Requer permissao formacao.marcarManual." }, 403);
  }
  const body = await c.req.json() as {
    edicaoId: string;
    pessoaId: string;
    pessoaNome: string;
    cracha: number;
    turmaId?: string;
    justificativa: string;
  };

  const id = idFormacao(body.edicaoId, body.pessoaId);
  try {
    const [row] = await sql`
      INSERT INTO formacoes (
        id, edicao_id, pessoa_id, turma_id, presenca_tipo,
        registrado_por_uid, registrado_por_nome, justificativa, dados_validados
      ) VALUES (
        ${id}, ${body.edicaoId}, ${body.pessoaId}, ${body.turmaId ?? null},
        'manual', ${sessao.uid}, ${sessao.nome},
        ${body.justificativa.trim()}, false
      ) RETURNING *
    `;
    await registrarEvento(
      sessao, "formacao.manual", `formacoes/${id}`,
      `${body.pessoaNome} (#${body.cracha}) — ${body.justificativa.trim()}`
    );
    return c.json(formacaoDeRow(row) as any, 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Esta pessoa já tem formação registrada." }, 409);
    throw err;
  }
});

const putFormacaoConfirmarRoute = createRoute({
  method: "put",
  path: "/{id}/confirmar",
  tags: ["Formações"],
  summary: "Confirma dados validados",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Atualizada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(putFormacaoConfirmarRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "formacao.marcarManual")) {
    return c.json({ erro: "Acesso negado. Requer permissao formacao.marcarManual." }, 403);
  }
  const body = await c.req.json() as { pessoaNome: string; cracha: number };
  const [row] = await sql`
    UPDATE formacoes SET dados_validados = true, validado_em = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Formação não encontrada." }, 404);
  await registrarEvento(
    sessao, "formacao.confirmouDados", `formacoes/${id}`,
    `${body.pessoaNome} (#${body.cracha})`
  );
  return c.json(formacaoDeRow(row) as any, 200);
});

const deleteFormacaoRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Formações"],
  summary: "Remove formação",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrada" }
  }
});

app.openapi(deleteFormacaoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "formacao.marcarManual")) {
    return c.json({ erro: "Acesso negado. Requer permissao formacao.marcarManual." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as { pessoaNome?: string; cracha?: number };
  const [row] = await sql`DELETE FROM formacoes WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ erro: "Formação não encontrada." }, 404);
  await registrarEvento(
    sessao, "formacao.removeu", `formacoes/${id}`,
    body.pessoaNome ? `${body.pessoaNome} (#${body.cracha})` : id
  );
  return c.json({ ok: true }, 200);
});

export default app;
