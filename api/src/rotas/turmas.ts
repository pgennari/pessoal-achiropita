import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function turmaDeRow(r: Record<string, unknown>) {
  const data = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data ?? "");
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    data,
    horarioInicio: r.horario_inicio,
    horarioFim: (r.horario_fim as string | null) ?? undefined,
    local: r.local,
    capacidadeMaxima: r.capacidade_maxima,
    setorVinculo: (r.setor_vinculo as string | null) ?? undefined,
    barracaIdVinculo: (r.barraca_id_vinculo as string | null) ?? undefined,
    criadoEm,
    atualizadoEm,
  };
}

// GET /api/turmas?edicaoId=:id
app.get("/", comAuth, async (c) => {
  const edicaoId = c.req.query("edicaoId");
  if (edicaoId) {
    const rows = await sql`
      SELECT * FROM turmas_formacao WHERE edicao_id = ${edicaoId}
      ORDER BY data, horario_inicio
    `;
    return c.json(rows.map(turmaDeRow));
  }
  const rows = await sql`SELECT * FROM turmas_formacao ORDER BY data, horario_inicio`;
  return c.json(rows.map(turmaDeRow));
});

// GET /api/turmas/:id
app.get("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const [row] = await sql`SELECT * FROM turmas_formacao WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Turma não encontrada." }, 404);
  return c.json(turmaDeRow(row));
});

// POST /api/turmas
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { edicaoId, data, horarioInicio, horarioFim, local, capacidadeMaxima, setorVinculo, barracaIdVinculo } = body;
  const [row] = await sql`
    INSERT INTO turmas_formacao (edicao_id, data, horario_inicio, horario_fim, local, capacidade_maxima, setor_vinculo, barraca_id_vinculo)
    VALUES (
      ${String(edicaoId ?? "")}, ${String(data ?? "")}, ${String(horarioInicio ?? "")},
      ${(horarioFim as string | null) ?? null}, ${String(local ?? "")},
      ${Number(capacidadeMaxima ?? 0)},
      ${(setorVinculo as string | null) ?? null},
      ${(barracaIdVinculo as string | null) ?? null}
    ) RETURNING *
  `;
  await registrarEvento(
    sessao, "turma.criou", `turmasFormacao/${row.id}`, `${data} ${horarioInicio}`
  );
  return c.json(turmaDeRow(row), 201);
});

// PUT /api/turmas/:id
app.put("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { data, horarioInicio, horarioFim, local, capacidadeMaxima, setorVinculo, barracaIdVinculo } = body;
  const [row] = await sql`
    UPDATE turmas_formacao SET
      data               = ${String(data ?? "")},
      horario_inicio     = ${String(horarioInicio ?? "")},
      horario_fim        = ${(horarioFim as string | null) ?? null},
      local              = ${String(local ?? "")},
      capacidade_maxima  = ${Number(capacidadeMaxima ?? 0)},
      setor_vinculo      = ${(setorVinculo as string | null) ?? null},
      barraca_id_vinculo = ${(barracaIdVinculo as string | null) ?? null},
      atualizado_em      = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Turma não encontrada." }, 404);
  await registrarEvento(
    sessao, "turma.atualizou", `turmasFormacao/${id}`, `${data} ${horarioInicio}`
  );
  return c.json(turmaDeRow(row));
});

// DELETE /api/turmas/:id — cascade revoga links e remove turma
app.delete("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  // Revoga links ativos antes de deletar (ON DELETE CASCADE remove os registros).
  await sql`UPDATE links_validacao SET status = 'revogado' WHERE turma_id = ${id} AND status = 'ativo'`;
  const [row] = await sql`
    DELETE FROM turmas_formacao WHERE id = ${id} RETURNING data, horario_inicio
  `;
  if (!row) return c.json({ erro: "Turma não encontrada." }, 404);
  await registrarEvento(
    sessao, "turma.removeu", `turmasFormacao/${id}`, `${row.data} ${row.horario_inicio}`
  );
  return c.json({ ok: true });
});

export default app;
