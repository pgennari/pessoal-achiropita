import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function equipeDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    nome: r.nome,
    setor: r.setor,
    vagasCoordenador: r.vagas_coordenador,
    vagasEquipista: r.vagas_equipista,
    vagasApoio: r.vagas_apoio,
    criadoEm,
    atualizadoEm,
  };
}

// GET /api/equipes?edicaoId=:id
app.get("/", comAuth, async (c) => {
  const edicaoId = c.req.query("edicaoId");
  if (edicaoId) {
    const rows = await sql`SELECT * FROM equipes WHERE edicao_id = ${edicaoId} ORDER BY nome`;
    return c.json(rows.map(equipeDeRow));
  }
  const rows = await sql`SELECT * FROM equipes ORDER BY nome`;
  return c.json(rows.map(equipeDeRow));
});

// GET /api/equipes/:id
app.get("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const [row] = await sql`SELECT * FROM equipes WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Equipe não encontrada." }, 404);
  return c.json(equipeDeRow(row));
});

// POST /api/equipes
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { edicaoId, nome, setor, vagasCoordenador, vagasEquipista, vagasApoio } = body;
  const [row] = await sql`
    INSERT INTO equipes (edicao_id, nome, setor, vagas_coordenador, vagas_equipista, vagas_apoio)
    VALUES (
      ${String(edicaoId ?? "")}, ${String(nome ?? "")}, ${String(setor ?? "Interna")},
      ${Number(vagasCoordenador ?? 0)}, ${Number(vagasEquipista ?? 0)}, ${Number(vagasApoio ?? 0)}
    ) RETURNING *
  `;
  await registrarEvento(sessao, "equipe.criou", `equipes/${row.id}`, String(nome ?? ""));
  return c.json(equipeDeRow(row), 201);
});

// PUT /api/equipes/:id
app.put("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { nome, setor, vagasCoordenador, vagasEquipista, vagasApoio } = body;
  const [row] = await sql`
    UPDATE equipes SET
      nome              = ${String(nome ?? "")},
      setor             = ${String(setor ?? "Interna")},
      vagas_coordenador = ${Number(vagasCoordenador ?? 0)},
      vagas_equipista   = ${Number(vagasEquipista ?? 0)},
      vagas_apoio       = ${Number(vagasApoio ?? 0)},
      atualizado_em     = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Equipe não encontrada." }, 404);
  await registrarEvento(sessao, "equipe.atualizou", `equipes/${id}`, String(nome ?? ""));
  return c.json(equipeDeRow(row));
});

// DELETE /api/equipes/:id — cascade remove participações via FK
app.delete("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`DELETE FROM equipes WHERE id = ${id} RETURNING nome`;
  if (!row) return c.json({ erro: "Equipe não encontrada." }, 404);
  await registrarEvento(sessao, "equipe.removeu", `equipes/${id}`, String(row.nome));
  return c.json({ ok: true });
});

// POST /api/equipes/copiar
app.post("/copiar", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const { edicaoOrigemId, edicaoDestinoId } = await c.req.json() as {
    edicaoOrigemId: string;
    edicaoDestinoId: string;
  };
  const result = await sql`
    INSERT INTO equipes (edicao_id, nome, setor, vagas_coordenador, vagas_equipista, vagas_apoio, criado_em, atualizado_em)
    SELECT ${edicaoDestinoId}, nome, setor, vagas_coordenador, vagas_equipista, vagas_apoio, NOW(), NOW()
    FROM equipes WHERE edicao_id = ${edicaoOrigemId}
    RETURNING id
  `;
  const copiadas = result.length;
  if (copiadas > 0) {
    await registrarEvento(
      sessao,
      "equipe.copiouEdicao",
      `equipes/edicao:${edicaoDestinoId}`,
      `${copiadas} equipe(s) copiada(s) de ${edicaoOrigemId}`
    );
  }
  return c.json({ copiadas });
});

export default app;
