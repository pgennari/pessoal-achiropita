import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import { podeVerRelatorio } from "../relatorioAvaliacao.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const SetorSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cor: z.string(),
  editavel: z.boolean(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

function setorDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    nome: r.nome,
    cor: r.cor,
    editavel: !!r.editavel,
    criadoEm,
    atualizadoEm,
  };
}

const msgErro = z.object({ erro: z.string() });

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Setores"],
  summary: "Lista todos os setores",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.array(SetorSchema) } },
      description: "Lista de setores",
    },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
  },
});

app.openapi(getRoute, async (c) => {
  const sessao = c.get("sessao");
  // Leitor do relatorio de avaliacoes precisa da lista de setores para os
  // filtros; setores sao um catalogo pequeno e fixo.
  if (!temPermissao(sessao, "setor.lista") && !podeVerRelatorio(sessao)) {
    return c.json({ erro: "Acesso negado. Requer permissao setor.lista." }, 403);
  }
  const rows = await sql`SELECT * FROM setores ORDER BY id`;
  return c.json(rows.map(setorDeRow) as any, 200);
});

const putRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Setores"],
  summary: "Atualiza nome e/ou cor de um setor",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            nome: z.string().optional(),
            cor: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: SetorSchema } }, description: "Atualizado" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(putRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "setor.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao setor.editar." }, 403);
  }
  const body = c.req.valid("json");

  if (!body.nome && !body.cor) {
    return c.json({ erro: "Envie ao menos nome ou cor para atualizar." }, 400);
  }

  const [row] = await sql`
    UPDATE setores SET
      nome = COALESCE(${body.nome?.trim() ?? null}, nome),
      cor = COALESCE(${body.cor?.trim() ?? null}, cor),
      atualizado_em = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Setor nao encontrado." }, 404);

  const detalhes = body.nome ? `${body.nome} (${id})` : id;
  await registrarEvento(sessao, "setor.atualizou", `setores/${id}`, detalhes);
  return c.json(setorDeRow(row) as any, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Setores"],
  summary: "Cadastra novo setor",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.string().optional(),
            nome: z.string(),
            cor: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: SetorSchema } }, description: "Criado com sucesso" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Conflito: ID ja existe" },
  },
});

function gerarId(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
}

app.openapi(postRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "setor.incluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao setor.incluir." }, 403);
  }
  const body = c.req.valid("json");
  if (!body.nome.trim()) {
    return c.json({ erro: "Nome obrigatorio." }, 400);
  }
  if (!body.cor.trim()) {
    return c.json({ erro: "Cor obrigatoria." }, 400);
  }

  const id = body.id?.trim() || gerarId(body.nome);
  if (!id) {
    return c.json({ erro: "Nao foi possivel gerar ID a partir do nome." }, 400);
  }

  const [existente] = await sql`SELECT id FROM setores WHERE id = ${id}`;
  if (existente) {
    return c.json({ erro: `Ja existe um setor com o ID "${id}".` }, 409);
  }

  const [row] = await sql`
    INSERT INTO setores (id, nome, cor, editavel)
    VALUES (${id}, ${body.nome.trim()}, ${body.cor.trim()}, TRUE)
    RETURNING *
  `;

  await registrarEvento(sessao, "setor.criou", `setores/${id}`, body.nome);
  return c.json(setorDeRow(row) as any, 201);
});

export default app;
