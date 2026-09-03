import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuthReal } from "../auth.js";
import { ehADM } from "../pbac.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

// Gerenciamento da simulacao (031). Estas rotas usam comAuthReal de proposito:
// a sessao real e necessaria para permitir que o ADM entre e saia do modo
// simulacao mesmo com a simulacao ativa no browser. O efeito da simulacao nao
// e persistido aqui; ele e aplicado por headers em cada request (comAuth).
// Estes endpoints apenas registram a trilha de auditoria.

const ativarSchema = z.object({
  perfis: z.array(z.string().min(1).max(20)).min(1),
  equipesCRD: z.array(z.string()).optional(),
});

const ativarRoute = createRoute({
  method: "post",
  path: "/ativar",
  tags: ["Simulação"],
  summary: "Registra inicio de simulacao de perfil",
  middleware: [comAuthReal as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: ativarSchema } },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Simulacao iniciada" },
    400: { content: { "application/json": { schema: z.any() } }, description: "Dados inválidos" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
  },
});

app.openapi(ativarRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!ehADM(sessao)) {
    return c.json({ erro: "Acesso negado. Somente ADM pode simular acessos." }, 403);
  }
  const body = c.req.valid("json");
  // Valida que todos os perfis existem.
  for (const p of body.perfis) {
    const [perf] = await sql`SELECT sigla FROM perfis WHERE sigla = ${p}`;
    if (!perf) {
      return c.json({ erro: `Perfil inexistente: ${p}` }, 400);
    }
  }
  const detalhes = `${body.perfis.join(", ")}${
    body.equipesCRD?.length ? ` · ${body.equipesCRD.length} equipe(s)` : ""
  }`;
  await registrarEvento(sessao, "simulacao.ativou", "simulacao", detalhes);
  return c.json({ ok: true }, 200);
});

const encerrarRoute = createRoute({
  method: "delete",
  path: "/",
  tags: ["Simulação"],
  summary: "Registra fim da simulacao de perfil",
  middleware: [comAuthReal as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Simulacao encerrada" },
    403: { content: { "application/json": { schema: z.any() } }, description: "Acesso negado" },
  },
});

app.openapi(encerrarRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!ehADM(sessao)) {
    return c.json({ erro: "Acesso negado. Somente ADM pode encerrar simulacoes." }, 403);
  }
  await registrarEvento(sessao, "simulacao.encerrou", "simulacao");
  return c.json({ ok: true }, 200);
});

export default app;