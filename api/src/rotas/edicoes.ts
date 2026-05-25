import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function edicaoDeRow(r: Record<string, unknown>) {
  const inicio = r.inicio instanceof Date ? r.inicio.toISOString().slice(0, 10) : String(r.inicio ?? "");
  const fim = r.fim instanceof Date ? r.fim.toISOString().slice(0, 10) : String(r.fim ?? "");
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    numero: r.numero,
    ano: r.ano,
    inicio,
    fim,
    status: r.status,
    criadoEm,
    atualizadoEm,
  };
}

// GET /api/edicoes
app.get("/", comAuth, async (c) => {
  const rows = await sql`SELECT * FROM edicoes ORDER BY ano DESC`;
  return c.json(rows.map(edicaoDeRow));
});

// GET /api/edicoes/ativa
app.get("/ativa", comAuth, async (c) => {
  const [row] = await sql`SELECT * FROM edicoes WHERE status = 'ativa' LIMIT 1`;
  return c.json(row ? edicaoDeRow(row) : null);
});

// GET /api/edicoes/:id
app.get("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const [row] = await sql`SELECT * FROM edicoes WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Edição não encontrada." }, 404);
  return c.json(edicaoDeRow(row));
});

// POST /api/edicoes
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { numero, ano, inicio, fim, status } = body;

  let row: Record<string, unknown>;
  try {
    if (status === "ativa") {
      // Transação: encerra a ativa atual e cria a nova como ativa.
      const rows = await sql.begin(async (t) => {
        await t`UPDATE edicoes SET status = 'encerrada', atualizado_em = NOW() WHERE status = 'ativa'`;
        return t`
          INSERT INTO edicoes (numero, ano, inicio, fim, status)
          VALUES (${Number(numero)}, ${Number(ano)}, ${String(inicio)}, ${String(fim)}, ${String(status)})
          RETURNING *
        `;
      });
      row = rows[0] as Record<string, unknown>;
    } else {
      [row] = await sql`
        INSERT INTO edicoes (numero, ano, inicio, fim, status)
        VALUES (${Number(numero)}, ${Number(ano)}, ${String(inicio)}, ${String(fim)}, ${String(status ?? "planejamento")})
        RETURNING *
      `;
    }
  } catch (err: unknown) {
    const e = err as { code?: string };
    // Violação do UNIQUE INDEX idx_edicoes_so_uma_ativa
    if (e.code === "23505") return c.json({ erro: "Já existe uma edição ativa." }, 409);
    throw err;
  }

  await registrarEvento(sessao, "edicao.criou", `edicoes/${row.id}`, `${numero}ª (${ano})`);
  return c.json(edicaoDeRow(row), 201);
});

// PUT /api/edicoes/:id
app.put("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { numero, ano, inicio, fim, status } = body;

  let row: Record<string, unknown>;
  try {
    if (status === "ativa") {
      const rows = await sql.begin(async (t) => {
        await t`UPDATE edicoes SET status = 'encerrada', atualizado_em = NOW() WHERE status = 'ativa' AND id != ${id}`;
        return t`
          UPDATE edicoes SET
            numero = ${Number(numero)}, ano = ${Number(ano)},
            inicio = ${String(inicio)}, fim = ${String(fim)},
            status = 'ativa', atualizado_em = NOW()
          WHERE id = ${id} RETURNING *
        `;
      });
      row = rows[0] as Record<string, unknown>;
    } else {
      [row] = await sql`
        UPDATE edicoes SET
          numero = ${Number(numero)}, ano = ${Number(ano)},
          inicio = ${String(inicio)}, fim = ${String(fim)},
          status = ${String(status ?? "planejamento")}, atualizado_em = NOW()
        WHERE id = ${id} RETURNING *
      `;
    }
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Já existe uma edição ativa." }, 409);
    throw err;
  }

  if (!row) return c.json({ erro: "Edição não encontrada." }, 404);
  await registrarEvento(sessao, "edicao.atualizou", `edicoes/${id}`, `${numero}ª`);
  return c.json(edicaoDeRow(row));
});

// POST /api/edicoes/:id/ativar
app.post("/:id/ativar", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql.begin(async (t) => {
    await t`UPDATE edicoes SET status = 'encerrada', atualizado_em = NOW() WHERE status = 'ativa'`;
    return t`UPDATE edicoes SET status = 'ativa', atualizado_em = NOW() WHERE id = ${id} RETURNING numero, ano`;
  });
  if (!row) return c.json({ erro: "Edição não encontrada." }, 404);
  await registrarEvento(sessao, "edicao.ativou", `edicoes/${id}`, `${row.numero}ª (${row.ano})`);
  return c.json({ ok: true });
});

// POST /api/edicoes/:id/encerrar
app.post("/:id/encerrar", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`
    UPDATE edicoes SET status = 'encerrada', atualizado_em = NOW()
    WHERE id = ${id} RETURNING numero, ano
  `;
  if (!row) return c.json({ erro: "Edição não encontrada." }, 404);
  await registrarEvento(sessao, "edicao.encerrou", `edicoes/${id}`, `${row.numero}ª (${row.ano})`);
  return c.json({ ok: true });
});

export default app;
