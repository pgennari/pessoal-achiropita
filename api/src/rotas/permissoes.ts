import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeGerirPerfis } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import { isErroDuplicado, permissaoDeRow } from "../pbac.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const PermissaoSchema = z.object({
  codigo: z.string(),
  rotulo: z.string(),
  descricao: z.string(),
  ativo: z.boolean(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

const msgErro = z.object({ erro: z.string() });

const REGEX_CODIGO = /^[a-z0-9.]{1,40}$/;
const CODIGO_GERENCIA = "perfis.gerenciar";

// Todas as rotas do catalogo exigem a permissao de gerencia (na pratica ADM).

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Permissoes"],
  summary: "Lista o catalogo de permissoes",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      todos: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PermissaoSchema) } },
      description: "Catalogo de permissoes",
    },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(getRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeGerirPerfis(sessao)) {
    return c.json({ erro: "Acesso negado. Requer a permissão de gerir perfis." }, 403);
  }
  const todos = c.req.query("todos") === "true";
  const rows = todos
    ? await sql`SELECT * FROM permissoes ORDER BY codigo`
    : await sql`SELECT * FROM permissoes WHERE ativo = TRUE ORDER BY codigo`;
  return c.json(rows.map(permissaoDeRow) as any, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Permissoes"],
  summary: "Cria uma permissao no catalogo",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            codigo: z.string(),
            rotulo: z.string(),
            descricao: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: PermissaoSchema } }, description: "Criada" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Codigo ja existe" },
  },
});

app.openapi(postRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeGerirPerfis(sessao)) {
    return c.json({ erro: "Acesso negado. Requer a permissão de gerir perfis." }, 403);
  }
  const body = await c.req.json() as { codigo: string; rotulo: string; descricao?: string };

  const codigo = String(body.codigo ?? "").trim().toLowerCase();
  if (!REGEX_CODIGO.test(codigo)) {
    return c.json({ erro: "Código inválido. Use letras minúsculas, números e pontos (até 40 caracteres)." }, 400);
  }
  const rotulo = String(body.rotulo ?? "").trim();
  if (!rotulo) return c.json({ erro: "O rótulo da permissão é obrigatório." }, 400);
  if (rotulo.length > 80) return c.json({ erro: "O rótulo deve ter no máximo 80 caracteres." }, 400);
  const descricao = String(body.descricao ?? "").trim();
  if (descricao.length > 280) return c.json({ erro: "A descrição deve ter no máximo 280 caracteres." }, 400);

  let row: Record<string, unknown>;
  try {
    const [r] = await sql`
      INSERT INTO permissoes (codigo, rotulo, descricao)
      VALUES (${codigo}, ${rotulo}, ${descricao})
      RETURNING *
    `;
    row = r;
  } catch (e) {
    if (isErroDuplicado(e)) {
      return c.json({ erro: `Já existe uma permissão com o código "${codigo}".` }, 409);
    }
    throw e;
  }

  await registrarEvento(sessao, "permissao.criou", `permissoes/${codigo}`, rotulo);

  // FR-016: novas permissoes sao associadas automaticamente ao perfil ADM.
  // Falha aqui nao impede a criacao: o ADM ja recebe acesso via superuser.
  try {
    await sql`UPDATE perfis SET permissoes = permissoes || ${[codigo]}, atualizado_em = NOW() WHERE sigla = 'ADM'`;
    await registrarEvento(sessao, "permissao.associou-adm", `perfis/ADM`, codigo);
  } catch {
    console.error(`[Permissao] nao associou ${codigo} ao perfil ADM`);
  }

  return c.json(permissaoDeRow(row) as any, 201);
});

const putRoute = createRoute({
  method: "put",
  path: "/{codigo}",
  tags: ["Permissoes"],
  summary: "Atualiza rotulo, descricao e status de uma permissao",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ codigo: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            rotulo: z.string().optional(),
            descricao: z.string().optional(),
            ativo: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: PermissaoSchema } }, description: "Atualizada" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos ou permissao protegida" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrada" },
  },
});

app.openapi(putRoute, async (c) => {
  const { codigo } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeGerirPerfis(sessao)) {
    return c.json({ erro: "Acesso negado. Requer a permissão de gerir perfis." }, 403);
  }
  const body = await c.req.json() as { rotulo?: string; descricao?: string; ativo?: boolean };

  const [atual] = await sql`SELECT * FROM permissoes WHERE codigo = ${codigo}`;
  if (!atual) return c.json({ erro: "Permissão não encontrada." }, 404);

  if (body.rotulo !== undefined) {
    const rotulo = String(body.rotulo).trim();
    if (!rotulo) return c.json({ erro: "O rótulo da permissão é obrigatório." }, 400);
    if (rotulo.length > 80) return c.json({ erro: "O rótulo deve ter no máximo 80 caracteres." }, 400);
  }
  if (body.descricao !== undefined && String(body.descricao).trim().length > 280) {
    return c.json({ erro: "A descrição deve ter no máximo 280 caracteres." }, 400);
  }
  if (body.ativo !== undefined && body.ativo === false && codigo === CODIGO_GERENCIA) {
    return c.json({ erro: "A permissão de gerência do catálogo nunca pode ser desativada." }, 400);
  }
  if (body.rotulo === undefined && body.descricao === undefined && body.ativo === undefined) {
    return c.json({ erro: "Nada para atualizar." }, 400);
  }

  const rotulo = body.rotulo !== undefined ? String(body.rotulo).trim() : String(atual.rotulo);
  const descricao = body.descricao !== undefined ? String(body.descricao).trim() : String(atual.descricao);
  const ativo = body.ativo !== undefined ? body.ativo : !!atual.ativo;

  const [row] = await sql`
    UPDATE permissoes SET
      rotulo = ${rotulo},
      descricao = ${descricao},
      ativo = ${ativo},
      atualizado_em = NOW()
    WHERE codigo = ${codigo} RETURNING *
  `;

  const campos = [];
  if (body.rotulo !== undefined || body.descricao !== undefined) campos.push("dados");
  if (body.ativo !== undefined) campos.push(ativo ? "reativou" : "desativou");
  const acao = campos.includes("desativou")
    ? "permissao.desativou"
    : campos.includes("reativou")
      ? "permissao.reativou"
      : "permissao.atualizou";
  await registrarEvento(sessao, acao, `permissoes/${codigo}`, `${rotulo} (${campos.join(", ")})`);

  return c.json(permissaoDeRow(row) as any, 200);
});

export default app;
