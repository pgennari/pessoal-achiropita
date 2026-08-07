import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

function linkPresencaDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  return {
    id: r.id,
    diaFestaId: r.dia_festa_id,
    edicaoId: r.edicao_id,
    status: r.status,
    criadoPorUid: r.criado_por_uid,
    criadoPorNome: r.criado_por_nome,
    criadoEm,
  };
}

function presencaDeRow(r: Record<string, unknown>) {
  const registradoEm = r.registrado_em instanceof Date ? r.registrado_em.toISOString() : String(r.registrado_em ?? "");
  return {
    id: r.id,
    diaFestaId: r.dia_festa_id,
    edicaoId: r.edicao_id,
    equipeId: r.equipe_id,
    equipeNome: r.equipe_nome,
    pessoaId: r.pessoa_id,
    pessoaNome: r.pessoa_nome,
    cracha: Number(r.cracha),
    funcao: (r.funcao as string | null) ?? null,
    confirmadoPorNome: r.confirmado_por_nome,
    registradoEm,
  };
}

const getLinksPresencaRoute = createRoute({
  method: "get",
  path: "/links",
  tags: ["Presenca"],
  summary: "Lista links de presenca (filtro por edicaoId)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de links" }
  }
});

app.openapi(getLinksPresencaRoute, async (c) => {
  const query = c.req.valid("query");
  const edicaoId = query.edicaoId;
  const rows = edicaoId
    ? await sql`
        SELECT * FROM links_presenca WHERE edicao_id = ${edicaoId}
        ORDER BY criado_em DESC
      `
    : await sql`SELECT * FROM links_presenca ORDER BY criado_em DESC`;
  return c.json(rows.map(linkPresencaDeRow) as any, 200);
});

const postLinkPresencaRoute = createRoute({
  method: "post",
  path: "/links",
  tags: ["Presenca"],
  summary: "Gera link de presenca para um dia da festa (revoga o ativo)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            diaFestaId: z.string(),
            edicaoId: z.string(),
            token: z.string(),
          })
        }
      }
    }
  },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Inválido" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(postLinkPresencaRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = c.req.valid("json");

  const [dia] = await sql`
    SELECT id, data FROM dias_festa
    WHERE id = ${body.diaFestaId} AND edicao_id = ${body.edicaoId}
  `;
  if (!dia) {
    return c.json({ erro: "Dia da festa não encontrado nesta edição." }, 400);
  }

  let row: Record<string, unknown>;
  try {
    row = await sql.begin(async (t) => {
      await t`
        UPDATE links_presenca SET status = 'revogado'
        WHERE dia_festa_id = ${body.diaFestaId} AND status = 'ativo'
      `;
      const [novo] = await t`
        INSERT INTO links_presenca (
          id, dia_festa_id, edicao_id, status,
          criado_por_uid, criado_por_nome
        ) VALUES (
          ${body.token}, ${body.diaFestaId}, ${body.edicaoId}, 'ativo',
          ${sessao.uid}, ${sessao.nome}
        ) RETURNING *
      `;
      return novo;
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      return c.json({ erro: "Este token já está em uso. Tente novamente." }, 400);
    }
    throw err;
  }

  const dataDia = dia.data instanceof Date ? dia.data.toISOString().slice(0, 10) : String(dia.data ?? "");
  await registrarEvento(sessao, "presenca.link.gerou", `linksPresenca/${row.id}`, `dia ${dataDia}`);
  return c.json(linkPresencaDeRow(row) as any, 201);
});

const getPresencasRoute = createRoute({
  method: "get",
  path: "/presencas",
  tags: ["Presenca"],
  summary: "Lista presencas confirmadas de um dia da festa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ diaFestaId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de presencas" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(getPresencasRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const { diaFestaId } = c.req.valid("query");
  const rows = await sql`
    SELECT
      pr.id, pr.dia_festa_id, pr.edicao_id, pr.equipe_id, pr.pessoa_id,
      pr.pessoa_nome, pr.cracha, pr.confirmado_por_nome, pr.registrado_em,
      eq.nome AS equipe_nome, part.funcao
    FROM presencas pr
    JOIN equipes eq ON eq.id = pr.equipe_id
    LEFT JOIN participacoes part
      ON part.edicao_id = pr.edicao_id AND part.pessoa_id = pr.pessoa_id
    WHERE pr.dia_festa_id = ${diaFestaId}
    ORDER BY pr.registrado_em DESC, pr.pessoa_nome ASC
  `;
  return c.json(rows.map(presencaDeRow) as any, 200);
});

const getResumoEquipesRoute = createRoute({
  method: "get",
  path: "/resumo-equipes",
  tags: ["Presenca"],
  summary: "Resumo de presencas confirmadas por equipe de um dia",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ diaFestaId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Resumo por equipe" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Dia não encontrado" }
  }
});

app.openapi(getResumoEquipesRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const { diaFestaId } = c.req.valid("query");
  const [dia] = await sql`
    SELECT edicao_id FROM dias_festa WHERE id = ${diaFestaId}
  `;
  if (!dia) {
    return c.json({ erro: "Dia da festa não encontrado." }, 404);
  }
  const rows = await sql`
    SELECT
      eq.id AS equipe_id,
      eq.nome AS equipe_nome,
      COALESCE(total_cont.total, 0)::int AS total,
      COALESCE(pres.confirmados, 0)::int AS confirmados
    FROM equipes eq
    LEFT JOIN (
      SELECT part.equipe_id, COUNT(*)::int AS total
      FROM participacoes part
      JOIN pessoas p ON p.id = part.pessoa_id
      WHERE p.ativo = true
      GROUP BY part.equipe_id
    ) total_cont ON total_cont.equipe_id = eq.id
    LEFT JOIN (
      SELECT pr.equipe_id, COUNT(*)::int AS confirmados
      FROM presencas pr
      WHERE pr.dia_festa_id = ${diaFestaId}
      GROUP BY pr.equipe_id
    ) pres ON pres.equipe_id = eq.id
    WHERE eq.edicao_id = ${String(dia.edicao_id)}
      AND (total_cont.total IS NOT NULL OR pres.confirmados IS NOT NULL)
    ORDER BY eq.nome
  `;
  return c.json(
    rows.map((r) => ({
      equipeId: String(r.equipe_id),
      equipeNome: String(r.equipe_nome),
      confirmados: Number(r.confirmados),
      total: Number(r.total),
    })) as any,
    200
  );
});

export default app;
