import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeGerirPerfis, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import { apenasPermissoesAtivas } from "../pbac.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const PerfilSchema = z.object({
  sigla: z.string(),
  nome: z.string(),
  fixo: z.boolean(),
  permissoes: z.array(z.string()),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

const msgErro = z.object({ erro: z.string() });

function perfilDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    sigla: r.sigla,
    nome: r.nome,
    fixo: !!r.fixo,
    permissoes: (r.permissoes as string[] | null) ?? [],
    criadoEm,
    atualizadoEm,
  };
}

// Sigla padronizada: letras/digitos maiusculos, de 2 a 6 caracteres.
function normalizarSigla(valor: unknown): string | null {
  const s = String(valor ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(s)) return null;
  return s;
}

const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Perfis"],
  summary: "Lista perfis de acesso",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PerfilSchema) } },
      description: "Lista de perfis",
    },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(getRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const rows = await sql`SELECT * FROM perfis ORDER BY fixo DESC, sigla`;
  return c.json(rows.map(perfilDeRow) as any, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Perfis"],
  summary: "Cadastra novo perfil de acesso",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            sigla: z.string(),
            nome: z.string(),
            permissoes: z.array(z.string()).default([]),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: PerfilSchema } }, description: "Criado" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Sigla ja existe" },
  },
});

app.openapi(postRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeGerirPerfis(sessao)) {
    return c.json({ erro: "Acesso negado. Requer perfil ADM." }, 403);
  }
  const body = await c.req.json() as { sigla: string; nome: string; permissoes?: string[] };

  const sigla = normalizarSigla(body.sigla);
  if (!sigla) {
    return c.json({ erro: "Sigla inválida. Use 2 a 6 letras/dígitos (ex.: ADM, CRD)." }, 400);
  }
  const nome = String(body.nome ?? "").trim();
  if (!nome) return c.json({ erro: "Nome do perfil é obrigatório." }, 400);
  const permissoes = await apenasPermissoesAtivas(sql, Array.isArray(body.permissoes) ? body.permissoes : []);

  const [existente] = await sql`SELECT sigla FROM perfis WHERE sigla = ${sigla}`;
  if (existente) return c.json({ erro: `Já existe um perfil com a sigla "${sigla}".` }, 409);

  const [row] = await sql`
    INSERT INTO perfis (sigla, nome, fixo, permissoes)
    VALUES (${sigla}, ${nome}, FALSE, ${permissoes})
    RETURNING *
  `;
  await registrarEvento(sessao, "perfil.criou", `perfis/${sigla}`, `${nome} (${permissoes.length} permissões)`);
  return c.json(perfilDeRow(row) as any, 201);
});

const putRoute = createRoute({
  method: "put",
  path: "/{sigla}",
  tags: ["Perfis"],
  summary: "Atualiza nome e permissoes de um perfil",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ sigla: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            nome: z.string().optional(),
            permissoes: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: PerfilSchema } }, description: "Atualizado" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Perfil fixo ou dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(putRoute, async (c) => {
  const { sigla } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeGerirPerfis(sessao)) {
    return c.json({ erro: "Acesso negado. Requer perfil ADM." }, 403);
  }
  const body = await c.req.json() as { nome?: string; permissoes?: string[] };

  const [atual] = await sql`SELECT * FROM perfis WHERE sigla = ${sigla}`;
  if (!atual) return c.json({ erro: "Perfil não encontrado." }, 404);
  if (atual.fixo) {
    return c.json({ erro: "Perfil fixo (ADM) não pode ser alterado." }, 400);
  }

  const nome = body.nome !== undefined ? String(body.nome).trim() : String(atual.nome);
  if (!nome) return c.json({ erro: "Nome do perfil é obrigatório." }, 400);
  const permissoes = body.permissoes !== undefined
    ? await apenasPermissoesAtivas(sql, body.permissoes)
    : (atual.permissoes as string[] | null) ?? [];

  const [row] = await sql`
    UPDATE perfis SET
      nome = ${nome},
      permissoes = ${permissoes},
      atualizado_em = NOW()
    WHERE sigla = ${sigla} RETURNING *
  `;
  await registrarEvento(sessao, "perfil.atualizou", `perfis/${sigla}`, `${nome} (${permissoes.length} permissões)`);
  return c.json(perfilDeRow(row) as any, 200);
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{sigla}",
  tags: ["Perfis"],
  summary: "Remove um perfil de acesso",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ sigla: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Perfil fixo ou em uso" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(deleteRoute, async (c) => {
  const { sigla } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeGerirPerfis(sessao)) {
    return c.json({ erro: "Acesso negado. Requer perfil ADM." }, 403);
  }

  const [atual] = await sql`SELECT * FROM perfis WHERE sigla = ${sigla}`;
  if (!atual) return c.json({ erro: "Perfil não encontrado." }, 404);
  if (atual.fixo) {
    return c.json({ erro: "Perfil fixo (ADM) não pode ser excluído." }, 400);
  }

  const [emUso] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM usuarios WHERE perfil = ${sigla}) AS usuarios,
      (SELECT COUNT(*)::int FROM convites WHERE perfil = ${sigla}) AS convites
  `;
  if ((emUso.usuarios as number) > 0 || (emUso.convites as number) > 0) {
    return c.json({
      erro: `Não é possível excluir: ${emUso.usuarios} usuário(s) e ${emUso.convites} convite(s) usam este perfil. Reatribua antes de excluir.`,
    }, 400);
  }

  const [row] = await sql`DELETE FROM perfis WHERE sigla = ${sigla} RETURNING nome`;
  await registrarEvento(sessao, "perfil.removeu", `perfis/${sigla}`, row.nome as string);
  return c.json({ ok: true }, 200);
});

export default app;
