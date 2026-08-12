import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import { isErroDuplicado } from "../pbac.js";
import type { Parametro, Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const ParametroSchema = z.object({
  chave: z.string(),
  valor: z.string(),
  descricao: z.string(),
  ativo: z.boolean(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

const msgErro = z.object({ erro: z.string() });

const REGEX_CHAVE = /^[a-z0-9._-]{1,64}$/;
const MAX_VALOR = 10000;
const MAX_DESCRICAO = 280;
const PERMISSAO_ACESSO = "parametros.acessar";

function parametroDeRow(r: Record<string, unknown>): Parametro {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    chave: String(r.chave),
    valor: String(r.valor ?? ""),
    descricao: String(r.descricao ?? ""),
    ativo: !!r.ativo,
    criadoEm,
    atualizadoEm,
  };
}

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Parametros"],
  summary: "Lista os parametros do sistema",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      todos: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(ParametroSchema) } },
      description: "Lista de parametros",
    },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(getRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, PERMISSAO_ACESSO)) {
    return c.json({ erro: "Acesso negado. Requer permissao parametros.acessar." }, 403);
  }
  const todos = c.req.query("todos") === "true";
  const rows = todos
    ? await sql`SELECT * FROM parametros ORDER BY chave`
    : await sql`SELECT * FROM parametros WHERE ativo = TRUE ORDER BY chave`;
  return c.json(rows.map(parametroDeRow) as any, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Parametros"],
  summary: "Cria um parametro no sistema",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            chave: z.string(),
            valor: z.string().optional(),
            descricao: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: ParametroSchema } }, description: "Criado" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Chave ja existe" },
  },
});

app.openapi(postRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, PERMISSAO_ACESSO)) {
    return c.json({ erro: "Acesso negado. Requer permissao parametros.acessar." }, 403);
  }
  const body = await c.req.json() as { chave: string; valor?: string; descricao?: string };

  const chave = String(body.chave ?? "").trim().toLowerCase();
  if (!REGEX_CHAVE.test(chave)) {
    return c.json({ erro: "Chave inválida. Use letras minúsculas, números, pontos, hífen e sublinhado (até 64 caracteres)." }, 400);
  }
  const valor = String(body.valor ?? "");
  if (valor.length > MAX_VALOR) {
    return c.json({ erro: `O valor deve ter no máximo ${MAX_VALOR} caracteres.` }, 400);
  }
  const descricao = String(body.descricao ?? "").trim();
  if (descricao.length > MAX_DESCRICAO) {
    return c.json({ erro: `A descrição deve ter no máximo ${MAX_DESCRICAO} caracteres.` }, 400);
  }

  let row: Record<string, unknown>;
  try {
    const [r] = await sql`
      INSERT INTO parametros (chave, valor, descricao)
      VALUES (${chave}, ${valor}, ${descricao})
      RETURNING *
    `;
    row = r;
  } catch (e) {
    if (isErroDuplicado(e)) {
      return c.json({ erro: `Já existe um parâmetro com a chave "${chave}".` }, 409);
    }
    throw e;
  }

  await registrarEvento(sessao, "parametro.criou", `parametros/${chave}`, descricao || chave);

  return c.json(parametroDeRow(row) as any, 201);
});

const putRoute = createRoute({
  method: "put",
  path: "/{chave}",
  tags: ["Parametros"],
  summary: "Atualiza valor, descricao e status de um parametro",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ chave: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            valor: z.string().optional(),
            descricao: z.string().optional(),
            ativo: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: ParametroSchema } }, description: "Atualizado" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(putRoute, async (c) => {
  const { chave } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, PERMISSAO_ACESSO)) {
    return c.json({ erro: "Acesso negado. Requer permissao parametros.acessar." }, 403);
  }
  const body = await c.req.json() as { valor?: string; descricao?: string; ativo?: boolean };

  const [atual] = await sql`SELECT * FROM parametros WHERE chave = ${chave}`;
  if (!atual) return c.json({ erro: "Parâmetro não encontrado." }, 404);

  if (body.valor !== undefined && String(body.valor).length > MAX_VALOR) {
    return c.json({ erro: `O valor deve ter no máximo ${MAX_VALOR} caracteres.` }, 400);
  }
  if (body.descricao !== undefined && String(body.descricao).trim().length > MAX_DESCRICAO) {
    return c.json({ erro: `A descrição deve ter no máximo ${MAX_DESCRICAO} caracteres.` }, 400);
  }
  if (body.valor === undefined && body.descricao === undefined && body.ativo === undefined) {
    return c.json({ erro: "Nada para atualizar." }, 400);
  }

  const valor = body.valor !== undefined ? String(body.valor) : String(atual.valor);
  const descricao = body.descricao !== undefined ? String(body.descricao).trim() : String(atual.descricao);
  const ativo = body.ativo !== undefined ? body.ativo : !!atual.ativo;

  const [row] = await sql`
    UPDATE parametros SET
      valor = ${valor},
      descricao = ${descricao},
      ativo = ${ativo},
      atualizado_em = NOW()
    WHERE chave = ${chave} RETURNING *
  `;

  const campos = [];
  if (body.valor !== undefined || body.descricao !== undefined) campos.push("dados");
  if (body.ativo !== undefined) campos.push(ativo ? "reativou" : "desativou");
  const acao = campos.includes("desativou")
    ? "parametro.desativou"
    : campos.includes("reativou")
      ? "parametro.reativou"
      : "parametro.atualizou";
  await registrarEvento(sessao, acao, `parametros/${chave}`, `${descricao || chave} (${campos.join(", ")})`);

  return c.json(parametroDeRow(row) as any, 200);
});

export default app;
