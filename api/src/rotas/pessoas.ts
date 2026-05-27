import { Hono } from "hono";
import sql from "../db.js";
import { comAuth, podeAdministrar } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new Hono<Variaveis>();

function pessoaDeRow(r: Record<string, unknown>) {
  const nascimento = r.nascimento instanceof Date
    ? r.nascimento.toISOString().slice(0, 10)
    : String(r.nascimento ?? "");
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    cracha: r.cracha,
    nome: r.nome,
    nascimento,
    telefone: r.telefone ?? "",
    telefoneResidencial: r.telefone_residencial ?? undefined,
    telefoneComercial: r.telefone_comercial ?? undefined,
    email: r.email ?? undefined,
    cpf: r.cpf ?? undefined,
    rg: r.rg ?? undefined,
    endereco: r.endereco ?? undefined,
    bairro: r.bairro ?? undefined,
    cep: r.cep ?? undefined,
    estadoCivil: r.estado_civil ?? undefined,
    nomeConjuge: r.nome_conjuge ?? undefined,
    temEstacionamento: r.tem_estacionamento ?? false,
    frequentaRecreacao: r.frequenta_recreacao ?? false,
    parenteFesta: r.parente_festa ?? undefined,
    observacoes: r.observacoes ?? undefined,
    ativo: r.ativo,
    motivoInativacao: r.motivo_inativacao ?? undefined,
    filhos: r.filhos ?? [],
    carros: r.carros ?? [],
    criadoEm,
    atualizadoEm,
  };
}

// GET /api/pessoas
app.get("/", comAuth, async (c) => {
  const rows = await sql`SELECT * FROM pessoas ORDER BY cracha`;
  return c.json(rows.map(pessoaDeRow));
});

// GET /api/pessoas/proximo-cracha
app.get("/proximo-cracha", comAuth, async (c) => {
  const [row] = await sql`SELECT COALESCE(MAX(cracha), 0) + 1 AS proximo FROM pessoas`;
  return c.json({ proximo: Number(row.proximo) });
});

// GET /api/pessoas/:id
app.get("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const [row] = await sql`SELECT * FROM pessoas WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  return c.json(pessoaDeRow(row));
});

// POST /api/pessoas
app.post("/", comAuth, async (c) => {
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const { cracha, nome, nascimento, telefone } = body;
  if (!cracha || !nome || !nascimento || !telefone) {
    return c.json({ erro: "cracha, nome, nascimento e telefone são obrigatórios." }, 400);
  }
  try {
    const [row] = await sql`
      INSERT INTO pessoas (
        cracha, nome, nascimento, telefone,
        telefone_residencial, telefone_comercial, email, cpf, rg,
        endereco, bairro, cep, estado_civil, nome_conjuge,
        tem_estacionamento, frequenta_recreacao, parente_festa, observacoes,
        ativo, motivo_inativacao, filhos, carros
      ) VALUES (
        ${Number(cracha)}, ${String(nome)}, ${String(nascimento)}, ${String(telefone)},
        ${(body.telefoneResidencial as string | null) ?? null},
        ${(body.telefoneComercial as string | null) ?? null},
        ${(body.email as string | null) ?? null},
        ${(body.cpf as string | null) ?? null},
        ${(body.rg as string | null) ?? null},
        ${(body.endereco as string | null) ?? null},
        ${(body.bairro as string | null) ?? null},
        ${(body.cep as string | null) ?? null},
        ${(body.estadoCivil as string | null) ?? null},
        ${(body.nomeConjuge as string | null) ?? null},
        ${Boolean(body.temEstacionamento)},
        ${Boolean(body.frequentaRecreacao)},
        ${(body.parenteFesta as string | null) ?? null},
        ${(body.observacoes as string | null) ?? null},
        ${body.ativo !== false},
        ${(body.motivoInativacao as string | null) ?? null},
        ${sql.json((body.filhos ?? []) as never)},
        ${sql.json((body.carros ?? []) as never)}
      ) RETURNING *
    `;
    await registrarEvento(sessao, "pessoa.criou", `pessoas/${row.id}`, `${nome} (#${cracha})`);
    return c.json(pessoaDeRow(row), 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Crachá já cadastrado." }, 409);
    throw err;
  }
});

// PUT /api/pessoas/:id
app.put("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const body = await c.req.json() as Record<string, unknown>;
  const [row] = await sql`
    UPDATE pessoas SET
      nome                 = ${String(body.nome ?? "")},
      nascimento           = ${String(body.nascimento ?? "")},
      telefone             = ${(body.telefone as string | null) ?? null},
      telefone_residencial = ${(body.telefoneResidencial as string | null) ?? null},
      telefone_comercial   = ${(body.telefoneComercial as string | null) ?? null},
      email                = ${(body.email as string | null) ?? null},
      cpf                  = ${(body.cpf as string | null) ?? null},
      rg                   = ${(body.rg as string | null) ?? null},
      endereco             = ${(body.endereco as string | null) ?? null},
      bairro               = ${(body.bairro as string | null) ?? null},
      cep                  = ${(body.cep as string | null) ?? null},
      estado_civil         = ${(body.estadoCivil as string | null) ?? null},
      nome_conjuge         = ${(body.nomeConjuge as string | null) ?? null},
      tem_estacionamento   = ${Boolean(body.temEstacionamento)},
      frequenta_recreacao  = ${Boolean(body.frequentaRecreacao)},
      parente_festa        = ${(body.parenteFesta as string | null) ?? null},
      observacoes          = ${(body.observacoes as string | null) ?? null},
      ativo                = ${body.ativo !== false},
      motivo_inativacao    = ${(body.motivoInativacao as string | null) ?? null},
      filhos               = ${sql.json((body.filhos ?? []) as never)},
      carros               = ${sql.json((body.carros ?? []) as never)},
      atualizado_em        = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(sessao, "pessoa.atualizou", `pessoas/${id}`, String(body.nome ?? ""));
  return c.json(pessoaDeRow(row));
});

// PUT /api/pessoas/:id/ativacao — altera apenas o campo ativo
app.put("/:id/ativacao", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const { ativo } = await c.req.json() as { ativo: boolean };
  const [row] = await sql`
    UPDATE pessoas SET ativo = ${Boolean(ativo)}, atualizado_em = NOW()
    WHERE id = ${id} RETURNING id, nome, cracha
  `;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(
    sessao,
    ativo ? "pessoa.reativou" : "pessoa.inativou",
    `pessoas/${id}`,
    `${row.nome} (#${row.cracha})`
  );
  return c.json({ ok: true });
});

// DELETE /api/pessoas/:id
app.delete("/:id", comAuth, async (c) => {
  const id = c.req.param("id");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const [row] = await sql`
    DELETE FROM pessoas WHERE id = ${id} RETURNING id, nome, cracha
  `;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(
    sessao, "pessoa.excluiu", `pessoas/${id}`, `${row.nome} (#${row.cracha})`
  );
  return c.json({ ok: true });
});

export default app;
