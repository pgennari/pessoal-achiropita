import { Hono } from "hono";
import sql from "../db.js";
import { comAuth } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

// POST /api/admin/zerar — zera todas as tabelas de dados (apenas ADM)
// Mantém apenas a tabela de usuários e a auditoria (para não perder o log).
app.post("/zerar", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (sessao.perfil !== "ADM") {
    return c.json({ erro: "Acesso negado. Requer perfil ADM." }, 403);
  }

  await sql.begin(async (t) => {
    await t`TRUNCATE TABLE entregas_cracha CASCADE`;
    await t`TRUNCATE TABLE formacoes CASCADE`;
    await t`TRUNCATE TABLE links_validacao CASCADE`;
    await t`TRUNCATE TABLE links_foto CASCADE`;
    await t`TRUNCATE TABLE turmas_formacao CASCADE`;
    await t`TRUNCATE TABLE participacoes CASCADE`;
    await t`TRUNCATE TABLE equipes CASCADE`;
    await t`TRUNCATE TABLE edicoes CASCADE`;
    await t`TRUNCATE TABLE pessoas CASCADE`;
    await t`TRUNCATE TABLE convites CASCADE`;
    await t`TRUNCATE TABLE participacoes_historicas CASCADE`;
  });

  await registrarEvento(sessao, "admin.zerou", "sistema", "Zeragem completa de dados");
  return c.json({ ok: true });
});

export default app;
