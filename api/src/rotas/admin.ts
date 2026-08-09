import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeZerar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const postZerarRoute = createRoute({
  method: "post",
  path: "/zerar",
  tags: ["Admin"],
  summary: "Zera todas as tabelas de dados",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" }
  }
});

app.openapi(postZerarRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!podeZerar(sessao)) return c.json({ erro: "Acesso negado. Requer perfil ADM." }, 403);
  await sql.begin(async (t) => {
    await t`TRUNCATE TABLE formacoes CASCADE`;
    await t`TRUNCATE TABLE links_validacao CASCADE`;
    await t`TRUNCATE TABLE links_foto CASCADE`;
    await t`TRUNCATE TABLE turmas_formacao CASCADE`;
    await t`TRUNCATE TABLE participacoes CASCADE`;
    await t`TRUNCATE TABLE equipes CASCADE`;
    await t`TRUNCATE TABLE edicoes CASCADE`;
    await t`TRUNCATE TABLE pessoas CASCADE`;
    await t`TRUNCATE TABLE convites CASCADE`;
    await t`TRUNCATE TABLE participacoes_historicas CASCADE`;
  });
  await registrarEvento(sessao, "admin.zerou", "sistema", "Zeragem completa de dados");
  return c.json({ ok: true }, 200);
});

export default app;
