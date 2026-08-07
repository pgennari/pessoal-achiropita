import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { streamSSE } from "hono/streaming";
import admin from "firebase-admin";
import sql from "../db.js";
import { comAuth, podeOperarEstacionamentos } from "../auth.js";
import eventos from "../eventos.js";
import type { Variaveis, Sessao } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

// --- GET /api/estacionamentos/dashboard ---

const getDashboardRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Dashboard"],
  summary: "Estado inicial do dashboard de check-ins",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.any() } }, description: "Dashboard data" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
  },
});

app.openapi(getDashboardRoute, async (c) => {
  const sessao = c.var.sessao;
  if (!podeOperarEstacionamentos(sessao)) {
    return c.json({ erro: "Acesso negado. Requer permissao estacionamentos.operar." }, 403);
  }

  const [totalCheckins] = await sql`SELECT COUNT(*)::int AS total FROM checkins`;
  const [totalHoje] = await sql`SELECT COUNT(*)::int AS total FROM checkins WHERE data = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date`;
  const amostra = await sql`SELECT id, data, estacionamento_id FROM checkins LIMIT 3`;
  console.log("[Dashboard] total=%s hoje=%s amostra=%j", totalCheckins?.total, totalHoje?.total, amostra);

  const estacionamentos = await sql`
    SELECT
      e.id, e.nome, e.endereco, e.vagas_contratadas,
      COALESCE(COUNT(c.id) FILTER (WHERE c.data = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date), 0)::int AS checkins_hoje
    FROM estacionamentos e
    LEFT JOIN checkins c ON c.estacionamento_id = e.id AND c.data = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
    GROUP BY e.id
    ORDER BY e.nome
  `;

  const ultimosCheckins = await sql`
    SELECT id, timestamp, pessoa_nome, placa, modelo, cor, estacionamento_id, estacionamento_nome
    FROM checkins
    WHERE data = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
    ORDER BY timestamp DESC
  `;

  const agora = new Date().toISOString();
  const hoje = new Date().toISOString().slice(0, 10);

  const estacionamentosComOcupacao = (estacionamentos as Array<Record<string, unknown>>).map((e) => {
    const vagas = Number(e.vagas_contratadas ?? 0);
    const checkinsHoje = Number(e.checkins_hoje ?? 0);
    return {
      id: e.id,
      nome: e.nome,
      endereco: e.endereco,
      vagasContratadas: vagas,
      checkinsHoje,
      ocupacaoPercentual: vagas > 0 ? Math.round((checkinsHoje / vagas) * 100) : null,
    };
  });

  const checkinsResumo = (ultimosCheckins as Array<Record<string, unknown>>).map((c) => ({
    id: c.id,
    timestamp: c.timestamp instanceof Date ? c.timestamp.toISOString() : String(c.timestamp),
    pessoaNome: c.pessoa_nome,
    placa: c.placa,
    modelo: c.modelo,
    cor: c.cor,
    estacionamentoId: c.estacionamento_id,
    estacionamentoNome: c.estacionamento_nome,
  }));

  return c.json(
    {
      estacionamentos: estacionamentosComOcupacao,
      ultimosCheckins: checkinsResumo,
      timestamps: { geradoEm: agora, dataReferencia: hoje },
    },
    200,
  );
});

// --- GET /api/estacionamentos/dashboard/eventos (SSE) ---

const comAuthSSE = createMiddleware<{
  Variables: { sessao: Sessao };
}>(async (c, next) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ erro: "Token nao fornecido." }, 401);
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return c.json({ erro: "Token invalido ou expirado." }, 401);
  }

  const rows = await sql`
    SELECT u.uid, u.email, u.nome, u.perfil,
           COALESCE(p.permissoes, '{}') AS permissoes
    FROM usuarios u
    LEFT JOIN perfis p ON p.sigla = u.perfil
    WHERE u.uid = ${decoded.uid}
  `;
  if (rows.length === 0) {
    return c.json({ erro: "Usuario sem acesso ao sistema." }, 403);
  }

  const u = rows[0];
  if (!podeOperarEstacionamentos({ perfil: u.perfil as string, permissoes: (u.permissoes as string[] | null) ?? [] })) {
    return c.json({ erro: "Acesso negado. Requer permissao estacionamentos.operar." }, 403);
  }

  c.set("sessao", {
    uid: u.uid as string,
    email: u.email as string,
    nome: u.nome as string,
    perfil: u.perfil as string,
    permissoes: (u.permissoes as string[] | null) ?? [],
  });

  await next();
});

app.get("/eventos", comAuthSSE, async (c) => {
  return streamSSE(c, async (stream) => {
    const listener = (dados: Record<string, unknown>) => {
      stream.writeSSE({ data: JSON.stringify(dados), event: "checkin" });
    };

    eventos.on("checkin", listener);

    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: new Date().toISOString(), event: "heartbeat" });
    }, 30000);

    stream.onAbort(() => {
      eventos.off("checkin", listener);
      clearInterval(heartbeat);
    });

    await new Promise<void>(() => {});
  });
});

export default app;
