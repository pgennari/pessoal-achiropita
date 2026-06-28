import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const EstacionamentoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  endereco: z.string(),
  vagasContratadas: z.number().int(),
  vagasDistribuidas: z.number().int(),
  dentroPerimetro: z.boolean(),
  horarios: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

function estacionamentoDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    nome: r.nome,
    endereco: r.endereco,
    vagasContratadas: Number(r.vagas_contratadas ?? 0),
    vagasDistribuidas: Number(r.vagas_distribuidas ?? 0),
    dentroPerimetro: r.dentro_perimetro,
    horarios: r.horarios,
    criadoEm,
    atualizadoEm,
  };
}

const msgErro = z.object({ erro: z.string() });

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Estacionamentos"],
  summary: "Lista todos os estacionamentos",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.array(EstacionamentoSchema) } },
      description: "Lista de estacionamentos",
    },
  },
});

app.openapi(getRoute, async (c) => {
  const rows = await sql`SELECT * FROM estacionamentos ORDER BY endereco`;
  return c.json(rows.map(estacionamentoDeRow) as any, 200);
});

const getIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Estacionamentos"],
  summary: "Busca estacionamento por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: EstacionamentoSchema } }, description: "Estacionamento encontrado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(getIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await sql`SELECT * FROM estacionamentos WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  return c.json(estacionamentoDeRow(row) as any, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Estacionamentos"],
  summary: "Cadastra novo estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            nome: z.string(),
            endereco: z.string(),
            vagasContratadas: z.number().int(),
            vagasDistribuidas: z.number().int(),
            dentroPerimetro: z.boolean(),
            horarios: z.string(),
          })
        }
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: EstacionamentoSchema } }, description: "Criado com sucesso" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(postRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = c.req.valid("json");
  if (!body.nome.trim() || !body.endereco.trim() || body.vagasContratadas === undefined || body.vagasDistribuidas === undefined || !body.horarios.trim()) {
    return c.json({ erro: "nome, endereco, vagasContratadas, vagasDistribuidas e horarios sao obrigatorios." }, 400);
  }
  const [row] = await sql`
    INSERT INTO estacionamentos (nome, endereco, vagas_contratadas, vagas_distribuidas, dentro_perimetro, horarios)
    VALUES (${body.nome.trim()}, ${body.endereco.trim()}, ${body.vagasContratadas}, ${body.vagasDistribuidas}, ${body.dentroPerimetro}, ${body.horarios.trim()})
    RETURNING *
  `;
  await registrarEvento(sessao, "estacionamento.criou", `estacionamentos/${row.id}`, body.endereco);
  return c.json(estacionamentoDeRow(row) as any, 201);
});

const putRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Estacionamentos"],
  summary: "Atualiza estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            nome: z.string(),
            endereco: z.string(),
            vagasContratadas: z.number().int(),
            vagasDistribuidas: z.number().int(),
            dentroPerimetro: z.boolean(),
            horarios: z.string(),
          })
        }
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: EstacionamentoSchema } }, description: "Atualizado" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(putRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = c.req.valid("json");
  const [row] = await sql`
    UPDATE estacionamentos SET
      nome = ${body.nome.trim()},
      endereco = ${body.endereco.trim()},
      vagas_contratadas = ${body.vagasContratadas},
      vagas_distribuidas = ${body.vagasDistribuidas},
      dentro_perimetro = ${body.dentroPerimetro},
      horarios = ${body.horarios.trim()},
      atualizado_em = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  await registrarEvento(sessao, "estacionamento.atualizou", `estacionamentos/${id}`, body.endereco);
  return c.json(estacionamentoDeRow(row) as any, 200);
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Estacionamentos"],
  summary: "Exclui estacionamento",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`DELETE FROM estacionamentos WHERE id = ${id} RETURNING id, endereco`;
  if (!row) return c.json({ erro: "Estacionamento nao encontrado." }, 404);
  await registrarEvento(sessao, "estacionamento.excluiu", `estacionamentos/${id}`, String(row.endereco ?? ""));
  return c.json({ ok: true }, 200);
});

export default app;
