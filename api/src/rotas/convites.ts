import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function conviteDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const expiraEm = r.expira_em instanceof Date ? r.expira_em.toISOString() : String(r.expira_em ?? "");
  const usadoEm = r.usado_em instanceof Date
    ? r.usado_em.toISOString()
    : r.usado_em ? String(r.usado_em) : undefined;
  return {
    id: r.id,
    email: r.email,
    perfil: r.perfil,
    pessoaId: (r.pessoa_id as string | null) ?? undefined,
    barracasCRD: (r.barracas_crd as string[] | null) ?? undefined,
    status: r.status,
    criadoPorUid: r.criado_por_uid,
    criadoPorNome: r.criado_por_nome,
    criadoEm,
    expiraEm,
    usadoEm,
    usadoPorUid: (r.usado_por_uid as string | null) ?? undefined,
  };
}

// GET /api/convites
app.get("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const rows = await sql`SELECT * FROM convites ORDER BY criado_em DESC`;
  return c.json(rows.map(conviteDeRow));
});

// POST /api/convites
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { email, perfil, pessoaId, barracasCRD, token, expiraEm } = body;
  try {
    const [row] = await sql`
      INSERT INTO convites (id, email, perfil, pessoa_id, barracas_crd, status, criado_por_uid, criado_por_nome, expira_em)
      VALUES (
        ${String(token)}, ${String(email ?? "").toLowerCase()}, ${String(perfil ?? "EQP")},
        ${(pessoaId as string | null) ?? null},
        ${(barracasCRD as string[] | null) ?? null},
        'pendente', ${sessao.uid}, ${sessao.nome}, ${String(expiraEm ?? "")}
      ) RETURNING *
    `;
    await registrarEvento(sessao, "convite.gerou", `convites/${token}`, `${email} (${perfil})`);
    return c.json(conviteDeRow(row), 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Token de convite duplicado. Tente novamente." }, 409);
    throw err;
  }
});

// PUT /api/convites/:id
app.put("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const [row] = await sql`
    UPDATE convites SET
      perfil       = ${String(body.perfil ?? "EQP")},
      pessoa_id    = ${(body.pessoaId as string | null) ?? null},
      barracas_crd = ${(body.barracasCRD as string[] | null) ?? null}
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Convite não encontrado." }, 404);
  await registrarEvento(sessao, "convite.atualizou", `convites/${id}`, String(body.perfil ?? ""));
  return c.json(conviteDeRow(row));
});

// PUT /api/convites/:id/revogar
app.put("/:id/revogar", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`UPDATE convites SET status = 'revogado' WHERE id = ${id} RETURNING email`;
  if (!row) return c.json({ erro: "Convite não encontrado." }, 404);
  await registrarEvento(sessao, "convite.revogou", `convites/${id}`, String(row.email));
  return c.json({ ok: true });
});

// DELETE /api/convites/:id
app.delete("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`DELETE FROM convites WHERE id = ${id} RETURNING email`;
  if (!row) return c.json({ erro: "Convite não encontrado." }, 404);
  await registrarEvento(sessao, "convite.removeu", `convites/${id}`, String(row.email));
  return c.json({ ok: true });
});

export default app;
