import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function formacaoDeRow(r: Record<string, unknown>) {
  const presencaEm = r.presenca_em instanceof Date ? r.presenca_em.toISOString() : String(r.presenca_em ?? "");
  const validadoEm = r.validado_em instanceof Date
    ? r.validado_em.toISOString()
    : r.validado_em ? String(r.validado_em) : undefined;
  return {
    id: r.id,
    edicaoId: r.edicao_id,
    pessoaId: r.pessoa_id,
    turmaId: (r.turma_id as string | null) ?? undefined,
    presencaTipo: r.presenca_tipo,
    presencaEm,
    registradoPorUid: r.registrado_por_uid,
    registradoPorNome: r.registrado_por_nome,
    justificativa: (r.justificativa as string | null) ?? undefined,
    dadosValidados: Boolean(r.dados_validados),
    validadoEm,
  };
}

function idFormacao(edicaoId: string, pessoaId: string): string {
  return `${edicaoId}__${pessoaId}`;
}

// GET /api/formacoes?edicaoId=:id
app.get("/", comAuth, async (c) => {
  const edicaoId = c.req.query("edicaoId");
  if (edicaoId) {
    const rows = await sql`SELECT * FROM formacoes WHERE edicao_id = ${edicaoId}`;
    return c.json(rows.map(formacaoDeRow));
  }
  const rows = await sql`SELECT * FROM formacoes`;
  return c.json(rows.map(formacaoDeRow));
});

// POST /api/formacoes — marcar presença manual
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  const body = await c.req.json() as {
    edicaoId: string;
    pessoaId: string;
    pessoaNome: string;
    cracha: number;
    turmaId?: string;
    justificativa: string;
  };

  const id = idFormacao(body.edicaoId, body.pessoaId);
  try {
    const [row] = await sql`
      INSERT INTO formacoes (
        id, edicao_id, pessoa_id, turma_id, presenca_tipo,
        registrado_por_uid, registrado_por_nome, justificativa, dados_validados
      ) VALUES (
        ${id}, ${body.edicaoId}, ${body.pessoaId}, ${body.turmaId ?? null},
        'manual', ${sessao.uid}, ${sessao.nome},
        ${body.justificativa.trim()}, false
      ) RETURNING *
    `;
    await registrarEvento(
      sessao, "formacao.manual", `formacoes/${id}`,
      `${body.pessoaNome} (#${body.cracha}) — ${body.justificativa.trim()}`
    );
    return c.json(formacaoDeRow(row), 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Esta pessoa já tem formação registrada." }, 409);
    throw err;
  }
});

// PUT /api/formacoes/:id/confirmar — confirma os dados validados
app.put("/:id/confirmar", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  const body = await c.req.json() as { pessoaNome: string; cracha: number };
  const [row] = await sql`
    UPDATE formacoes SET dados_validados = true, validado_em = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Formação não encontrada." }, 404);
  await registrarEvento(
    sessao, "formacao.confirmouDados", `formacoes/${id}`,
    `${body.pessoaNome} (#${body.cracha})`
  );
  return c.json(formacaoDeRow(row));
});

// DELETE /api/formacoes/:id — remover formação (ADM/ORG only)
app.delete("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as { pessoaNome?: string; cracha?: number };
  const [row] = await sql`DELETE FROM formacoes WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ erro: "Formação não encontrada." }, 404);
  await registrarEvento(
    sessao, "formacao.removeu", `formacoes/${id}`,
    body.pessoaNome ? `${body.pessoaNome} (#${body.cracha})` : id
  );
  return c.json({ ok: true });
});

export default app;
