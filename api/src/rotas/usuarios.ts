import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function usuarioDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date ? r.criado_em.toISOString() : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date ? r.atualizado_em.toISOString() : String(r.atualizado_em ?? "");
  return {
    uid: r.uid,
    email: r.email,
    nome: r.nome,
    perfil: r.perfil,
    pessoaId: (r.pessoa_id as string | null) ?? undefined,
    equipesCRD: (r.equipes_crd as string[] | null) ?? undefined,
    tokenConvite: (r.token_convite as string | null) ?? undefined,
    criadoEm,
    atualizadoEm,
  };
}

// GET /api/usuarios
app.get("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const rows = await sql`SELECT * FROM usuarios ORDER BY nome`;
  return c.json(rows.map(usuarioDeRow));
});

// GET /api/usuarios/me — perfil do usuário autenticado
app.get("/me", comAuth, async (c) => {
  const sessao = c.get("sessao");
  const [row] = await sql`SELECT * FROM usuarios WHERE uid = ${sessao.uid}`;
  if (!row) return c.json({ erro: "Usuário não encontrado." }, 404);
  return c.json(usuarioDeRow(row));
});

// PUT /api/usuarios/:uid
app.put("/:uid", comAuth, async (c) => {
  const uid = c.req.param("uid");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const [row] = await sql`
    UPDATE usuarios SET
      email         = ${String(body.email ?? "")},
      nome          = ${String(body.nome ?? "")},
      perfil        = ${String(body.perfil ?? "EQP")},
      pessoa_id     = ${(body.pessoaId as string | null) ?? null},
      equipes_crd   = ${(body.equipesCRD as string[] | null) ?? null},
      atualizado_em = NOW()
    WHERE uid = ${uid} RETURNING *
  `;
  if (!row) return c.json({ erro: "Usuário não encontrado." }, 404);
  await registrarEvento(sessao, "usuario.atualizou", `usuarios/${uid}`, `${body.nome} (${body.perfil})`);
  return c.json(usuarioDeRow(row));
});

// DELETE /api/usuarios/:uid
app.delete("/:uid", comAuth, async (c) => {
  const uid = c.req.param("uid");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  if (uid === sessao.uid) {
    return c.json({ erro: "Não é possível remover seu próprio usuário." }, 400);
  }
  const [row] = await sql`DELETE FROM usuarios WHERE uid = ${uid} RETURNING nome, email`;
  if (!row) return c.json({ erro: "Usuário não encontrado." }, 404);
  await registrarEvento(sessao, "usuario.removeu", `usuarios/${uid}`, `${row.nome} (${row.email})`);
  return c.json({ ok: true });
});

export default app;
