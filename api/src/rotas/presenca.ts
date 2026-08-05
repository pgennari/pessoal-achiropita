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
  if (!podeAdministrar(sessao.perfil)) {
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

export default app;
