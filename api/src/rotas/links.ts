import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const MINUTOS_APOS_INICIO = 15;

function linkDeRow(r: Record<string, unknown>) {
  const expiraEm = r.expira_em instanceof Date ? r.expira_em.toISOString() : String(r.expira_em ?? "");
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    turmaId: r.turma_id,
    expiraEm,
    status: r.status,
    contadorUsos: r.contador_usos,
    rotuloOpcional: (r.rotulo_opcional as string | null) ?? undefined,
    criadoPorUid: r.criado_por_uid,
    criadoPorNome: r.criado_por_nome,
    criadoEm,
  };
}

function calcularExpiracao(data: string, horarioInicio: string): Date {
  if (!data || !horarioInicio) return new Date(Date.now() + 60 * 60 * 1000);
  const inicio = new Date(`${data}T${horarioInicio}:00`);
  return new Date(inicio.getTime() + MINUTOS_APOS_INICIO * 60 * 1000);
}

const getLinksRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Links"],
  summary: "Lista links (filtro por edicaoId ou turmaId)",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ edicaoId: z.string().optional(), turmaId: z.string().optional() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Lista de links" }
  }
});

app.openapi(getLinksRoute, async (c) => {
  const query = c.req.valid("query");
  const edicaoId = query.edicaoId;
  const turmaId = query.turmaId;
  if (edicaoId) {
    const rows = await sql`
      SELECT * FROM links_validacao WHERE edicao_id = ${edicaoId} ORDER BY criado_em DESC
    `;
    return c.json(rows.map(linkDeRow) as any, 200);
  }
  if (turmaId) {
    const rows = await sql`
      SELECT * FROM links_validacao WHERE turma_id = ${turmaId} ORDER BY criado_em DESC
    `;
    return c.json(rows.map(linkDeRow) as any, 200);
  }
  const rows = await sql`SELECT * FROM links_validacao ORDER BY criado_em DESC`;
  return c.json(rows.map(linkDeRow) as any, 200);
});

const postLinkRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Links"],
  summary: "Gerar link para turma",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: {
    201: { content: { "application/json": { schema: z.any() } }, description: "Criado" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Inválido" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(postLinkRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as {
    turmaId: string;
    edicaoId: string;
    turmaData: string;
    turmaHorarioInicio: string;
    token: string;
    expiraEm?: string;
    rotuloOpcional?: string;
  };

  const prazo = body.expiraEm
    ? new Date(body.expiraEm)
    : calcularExpiracao(body.turmaData, body.turmaHorarioInicio);

  if (prazo <= new Date()) {
    return c.json({ erro: "Prazo de expiração precisa ser no futuro." }, 400);
  }

  const [row] = await sql`
    INSERT INTO links_validacao (
      id, edicao_id, turma_id, expira_em, status, contador_usos,
      rotulo_opcional, criado_por_uid, criado_por_nome
    ) VALUES (
      ${body.token}, ${body.edicaoId}, ${body.turmaId},
      ${prazo.toISOString()}, 'ativo', 0,
      ${body.rotuloOpcional ?? null}, ${sessao.uid}, ${sessao.nome}
    ) RETURNING *
  `;
  await registrarEvento(
    sessao, "link.gerou", `linksValidacao/${body.token}`,
    `turma ${body.turmaData} ${body.turmaHorarioInicio} · expira ${prazo.toLocaleString("pt-BR")}`
  );
  return c.json(linkDeRow(row) as any, 201);
});

const putLinkRevogarRoute = createRoute({
  method: "put",
  path: "/{token}/revogar",
  tags: ["Links"],
  summary: "Revoga link",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ token: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Revogado" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.any() } }, description: "Não encontrado" }
  }
});

app.openapi(putLinkRevogarRoute, async (c) => {
  const { token } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`
    UPDATE links_validacao SET status = 'revogado' WHERE id = ${token} RETURNING turma_id
  `;
  if (!row) return c.json({ erro: "Link não encontrado." }, 404);
  await registrarEvento(sessao, "link.revogou", `linksValidacao/${token}`, `turma ${row.turma_id}`);
  return c.json({ ok: true }, 200);
});

const putLinkAjustarRoute = createRoute({
  method: "put",
  path: "/turma/{turmaId}/ajustar-prazo",
  tags: ["Links"],
  summary: "Ajusta prazo para turma",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ turmaId: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(putLinkAjustarRoute, async (c) => {
  const { turmaId } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as { turmaData: string; turmaHorarioInicio: string };
  const novoPrazo = calcularExpiracao(body.turmaData, body.turmaHorarioInicio);
  const result = await sql`
    UPDATE links_validacao SET expira_em = ${novoPrazo.toISOString()}
    WHERE turma_id = ${turmaId} AND status = 'ativo'
    RETURNING id
  `;
  if (result.length > 0) {
    await registrarEvento(
      sessao, "link.reagendou", `linksValidacao/turma:${turmaId}`,
      `${result.length} link(s) reagendado(s) para ${novoPrazo.toLocaleString("pt-BR")}`
    );
  }
  return c.json({ atualizados: result.length }, 200);
});

export default app;
