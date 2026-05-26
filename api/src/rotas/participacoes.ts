import { Hono } from "hono";
import sql from "../db.js";
import { comAuth } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function participacaoDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    equipeId: r.equipe_id,
    pessoaId: r.pessoa_id,
    funcao: r.funcao,
    criadoEm,
    atualizadoEm,
  };
}

// GET /api/participacoes?edicaoId=:id ou ?pessoaId=:id
app.get("/", comAuth, async (c) => {
  const edicaoId = c.req.query("edicaoId");
  const pessoaId = c.req.query("pessoaId");
  if (edicaoId) {
    const rows = await sql`SELECT * FROM participacoes WHERE edicao_id = ${edicaoId}`;
    return c.json(rows.map(participacaoDeRow));
  }
  if (pessoaId) {
    const rows = await sql`SELECT * FROM participacoes WHERE pessoa_id = ${pessoaId}`;
    return c.json(rows.map(participacaoDeRow));
  }
  const rows = await sql`SELECT * FROM participacoes`;
  return c.json(rows.map(participacaoDeRow));
});

// POST /api/participacoes — alocar pessoa em equipe
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  const body = await c.req.json() as {
    edicaoId: string;
    equipeId: string;
    pessoaId: string;
    funcao: string;
    pessoaNome: string;
    equipeNome: string;
  };

  try {
    const [row] = await sql`
      INSERT INTO participacoes (edicao_id, equipe_id, pessoa_id, funcao)
      VALUES (${body.edicaoId}, ${body.equipeId}, ${body.pessoaId}, ${body.funcao})
      RETURNING *
    `;
    await registrarEvento(
      sessao, "participacao.alocou", `participacoes/${row.id}`,
      `${body.pessoaNome} → ${body.equipeNome} (${body.funcao})`
    );
    return c.json(participacaoDeRow(row), 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    // UNIQUE(edicao_id, pessoa_id) violation
    if (e.code === "23505") {
      return c.json({ erro: "Esta pessoa já está alocada em outra equipe nesta edição." }, 409);
    }
    throw err;
  }
});

// PUT /api/participacoes/:id — mover equipe ou trocar função
app.put("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  const body = await c.req.json() as {
    equipeId: string;
    funcao: string;
    pessoaNome?: string;
    equipeOrigemNome?: string;
    equipeDestinoNome?: string;
  };
  const [row] = await sql`
    UPDATE participacoes SET
      equipe_id     = ${body.equipeId},
      funcao        = ${body.funcao},
      atualizado_em = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Participação não encontrada." }, 404);

  const detalhe = body.pessoaNome
    ? `${body.pessoaNome}: ${body.equipeOrigemNome ?? "?"} → ${body.equipeDestinoNome ?? "?"} (${body.funcao})`
    : `funcao: ${body.funcao}`;
  await registrarEvento(sessao, "participacao.moveu", `participacoes/${id}`, detalhe);
  return c.json(participacaoDeRow(row));
});

// DELETE /api/participacoes/:id — desalocar
app.delete("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  const body = await c.req.json().catch(() => ({})) as {
    pessoaNome?: string;
    equipeNome?: string;
  };
  const [row] = await sql`DELETE FROM participacoes WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ erro: "Participação não encontrada." }, 404);
  await registrarEvento(
    sessao, "participacao.desalocou", `participacoes/${id}`,
    body.pessoaNome ? `${body.pessoaNome} de ${body.equipeNome ?? ""}` : id
  );
  return c.json({ ok: true });
});

export default app;
