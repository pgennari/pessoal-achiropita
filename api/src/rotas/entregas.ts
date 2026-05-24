import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function entregaDeRow(r: Record<string, unknown>) {
  const entregueEm = r.entregue_em instanceof Date ? r.entregue_em.toISOString() : String(r.entregue_em ?? "");
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    pessoaId: r.pessoa_id,
    entregueEm,
    operadorUid: r.operador_uid,
    operadorNome: r.operador_nome,
    observacao: (r.observacao as string | null) ?? undefined,
  };
}

function idEntrega(edicaoId: string, pessoaId: string): string {
  return `${edicaoId}__${pessoaId}`;
}

// GET /api/entregas?edicaoId=:id
app.get("/", comAuth, async (c) => {
  const edicaoId = c.req.query("edicaoId");
  if (edicaoId) {
    const rows = await sql`SELECT * FROM entregas_cracha WHERE edicao_id = ${edicaoId}`;
    return c.json(rows.map(entregaDeRow));
  }
  const rows = await sql`SELECT * FROM entregas_cracha`;
  return c.json(rows.map(entregaDeRow));
});

// POST /api/entregas — marcar crachá como entregue
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  const body = await c.req.json() as {
    edicaoId: string;
    pessoaId: string;
    pessoaNome: string;
    cracha: number;
    observacao?: string;
  };

  const id = idEntrega(body.edicaoId, body.pessoaId);
  try {
    const [row] = await sql`
      INSERT INTO entregas_cracha (id, edicao_id, pessoa_id, operador_uid, operador_nome, observacao)
      VALUES (
        ${id}, ${body.edicaoId}, ${body.pessoaId},
        ${sessao.uid}, ${sessao.nome}, ${body.observacao ?? null}
      ) RETURNING *
    `;
    await registrarEvento(
      sessao, "cracha.entregou", `entregasCracha/${id}`,
      `${body.pessoaNome} (#${body.cracha})`
    );
    return c.json(entregaDeRow(row), 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      return c.json({ erro: "Crachá já foi marcado como entregue. ADM pode desbloquear para reposição." }, 409);
    }
    throw err;
  }
});

// DELETE /api/entregas/:id — desbloquear (ADM only)
app.delete("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as { pessoaNome?: string; cracha?: number };
  const [row] = await sql`DELETE FROM entregas_cracha WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ erro: "Entrega não encontrada." }, 404);
  await registrarEvento(
    sessao, "cracha.desbloqueou", `entregasCracha/${id}`,
    body.pessoaNome ? `${body.pessoaNome} (#${body.cracha})` : id
  );
  return c.json({ ok: true });
});

export default app;
