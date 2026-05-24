import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

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

// GET /api/links?edicaoId=:id ou ?turmaId=:id
app.get("/", comAuth, async (c) => {
  const edicaoId = c.req.query("edicaoId");
  const turmaId = c.req.query("turmaId");
  if (edicaoId) {
    const rows = await sql`
      SELECT * FROM links_validacao WHERE edicao_id = ${edicaoId} ORDER BY criado_em DESC
    `;
    return c.json(rows.map(linkDeRow));
  }
  if (turmaId) {
    const rows = await sql`
      SELECT * FROM links_validacao WHERE turma_id = ${turmaId} ORDER BY criado_em DESC
    `;
    return c.json(rows.map(linkDeRow));
  }
  const rows = await sql`SELECT * FROM links_validacao ORDER BY criado_em DESC`;
  return c.json(rows.map(linkDeRow));
});

// POST /api/links — gerar link para turma
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
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
  return c.json(linkDeRow(row), 201);
});

// PUT /api/links/:token/revogar
app.put("/:token/revogar", comAuth, async (c) => {
  const token = c.req.param("token");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`
    UPDATE links_validacao SET status = 'revogado' WHERE id = ${token} RETURNING turma_id
  `;
  if (!row) return c.json({ erro: "Link não encontrado." }, 404);
  await registrarEvento(sessao, "link.revogou", `linksValidacao/${token}`, `turma ${row.turma_id}`);
  return c.json({ ok: true });
});

// PUT /api/links/turma/:turmaId/ajustar-prazo
app.put("/turma/:turmaId/ajustar-prazo", comAuth, async (c) => {
  const turmaId = c.req.param("turmaId");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
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
  return c.json({ atualizados: result.length });
});

export default app;
