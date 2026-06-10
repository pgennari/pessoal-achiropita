import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, podeAdministrar, podeEditarPessoa } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import { uploadFoto, deletarFoto } from "../r2.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const PessoaSchema = z.object({
  id: z.string().uuid(),
  cracha: z.number().int(),
  nome: z.string(),
  nascimento: z.string(),
  telefone: z.string().optional().nullable(),
  telefoneResidencial: z.string().optional().nullable(),
  telefoneComercial: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  cpf: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  estadoCivil: z.string().optional().nullable(),
  nomeConjuge: z.string().optional().nullable(),
  temEstacionamento: z.boolean(),
  frequentaRecreacao: z.boolean(),
  parenteFesta: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  ativo: z.boolean(),
  motivoInativacao: z.string().optional().nullable(),
  fotoUrl: z.string().optional().nullable(),
  filhos: z.array(z.any()),
  carros: z.array(z.any()),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

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
    fotoUrl: (r.foto_url as string | null) ?? undefined,
    filhos: r.filhos ?? [],
    carros: r.carros ?? [],
    criadoEm,
    atualizadoEm,
  };
}

// GET /api/pessoas
const getPessoasRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Pessoas"],
  summary: "Lista todas as pessoas",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PessoaSchema) } },
      description: "Lista de pessoas cadastradas",
    },
  },
});

app.openapi(getPessoasRoute, async (c) => {
  const sessao = c.get("sessao");
  if (sessao.perfil === "CRD" && sessao.equipesCRD?.length) {
    const equipes = sessao.equipesCRD;
    const rows = await sql<Record<string, unknown>[]>`
      SELECT DISTINCT p.* FROM pessoas p
      JOIN participacoes part ON part.pessoa_id = p.id
      JOIN edicoes e ON e.id = part.edicao_id AND e.status = 'ativa'
      WHERE part.equipe_id = ANY(${equipes})
      ORDER BY p.cracha
    `;
    return c.json(rows.map(pessoaDeRow) as any, 200);
  }
  const rows = await sql`SELECT * FROM pessoas ORDER BY cracha`;
  return c.json(rows.map(pessoaDeRow) as any, 200);
});

// GET /api/pessoas/proximo-cracha
const getProximoCrachaRoute = createRoute({
  method: "get",
  path: "/proximo-cracha",
  tags: ["Pessoas"],
  summary: "Obtém próximo número de crachá disponível",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { "application/json": { schema: z.object({ proximo: z.number() }) } }, description: "Próximo crachá" }
  }
});
app.openapi(getProximoCrachaRoute, async (c) => {
  const [row] = await sql`SELECT COALESCE(MAX(cracha), 0) + 1 AS proximo FROM pessoas`;
  return c.json({ proximo: Number(row.proximo) }, 200);
});

// GET /api/pessoas/:id
const getPessoaIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Pessoas"],
  summary: "Busca pessoa por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  responses: {
    200: { content: { "application/json": { schema: PessoaSchema } }, description: "Pessoa encontrada" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Pessoa não encontrada" }
  }
});
app.openapi(getPessoaIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await sql`SELECT * FROM pessoas WHERE id = ${id}`;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  return c.json(pessoaDeRow(row) as any, 200);
});

// POST /api/pessoas
const postPessoaRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Pessoas"],
  summary: "Cadastra nova pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: z.any() } } // Simplificado para facilitar migração inicial
    }
  },
  responses: {
    201: { content: { "application/json": { schema: PessoaSchema } }, description: "Criado com sucesso" },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Faltam campos" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Proibido" },
    409: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Conflito" }
  }
});
app.openapi(postPessoaRoute, async (c) => {
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
    return c.json(pessoaDeRow(row) as any, 201);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") return c.json({ erro: "Crachá já cadastrado." }, 409);
    throw err;
  }
});

// PUT /api/pessoas/:id
const putPessoaRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Pessoas"],
  summary: "Atualiza pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.any() } } }
  },
  responses: {
    200: { content: { "application/json": { schema: PessoaSchema } }, description: "Atualizado" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(putPessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeEditarPessoa(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM, ORG ou OPC." }, 403);
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
  return c.json(pessoaDeRow(row) as any, 200);
});

// PUT /api/pessoas/:id/ativacao
const putPessoaAtivacaoRoute = createRoute({
  method: "put",
  path: "/{id}/ativacao",
  tags: ["Pessoas"],
  summary: "Altera status de ativação da pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.object({ ativo: z.boolean() }) } } }
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(putPessoaAtivacaoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  }
  const { ativo } = c.req.valid("json");
  const [row] = await sql`
    UPDATE pessoas SET ativo = ${Boolean(ativo)}, atualizado_em = NOW()
    WHERE id = ${id} RETURNING id, nome, cracha
  `;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(sessao, ativo ? "pessoa.reativou" : "pessoa.inativou", `pessoas/${id}`, `${row.nome} (#${row.cracha})`);
  return c.json({ ok: true }, 200);
});


// POST /api/pessoas/:id/foto
const postPessoaFotoRoute = createRoute({
  method: "post",
  path: "/{id}/foto",
  tags: ["Pessoas"],
  summary: "Upload de foto",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() })
    // multipart/form-data schema is complex for OpenAPI spec right now, simplify
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ fotoUrl: z.string() }) } }, description: "Sucesso" },
    400: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Erro no arquivo" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(postPessoaFotoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeEditarPessoa(sessao.perfil)) {
    return c.json({ erro: "Acesso negado. Requer ADM, ORG ou OPC." }, 403);
  }
  const body = await c.req.parseBody();
  const foto = body["foto"];
  if (!foto || typeof foto === "string") return c.json({ erro: "Campo 'foto' com arquivo JPEG é obrigatório." }, 400);
  if (foto.type !== "image/jpeg") return c.json({ erro: "Apenas arquivos JPEG são aceitos. Redimensione antes do envio." }, 400);
  const LIMITE = 2 * 1024 * 1024;
  if (foto.size > LIMITE) return c.json({ erro: "Arquivo maior que 2 MB após processamento." }, 400);
  const buffer = Buffer.from(await foto.arrayBuffer());
  const fotoUrl = await uploadFoto(id, buffer);
  const [row] = await sql`UPDATE pessoas SET foto_url = ${fotoUrl}, atualizado_em = NOW() WHERE id = ${id} RETURNING id, nome, cracha`;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(sessao, "pessoa.foto.atualizou", `pessoas/${id}`, `${row.nome} (#${row.cracha})`);
  return c.json({ fotoUrl }, 200);
});

// DELETE /api/pessoas/:id/foto
const deletePessoaFotoRoute = createRoute({
  method: "delete",
  path: "/{id}/foto",
  tags: ["Pessoas"],
  summary: "Deletar foto",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(deletePessoaFotoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  const [row] = await sql`UPDATE pessoas SET foto_url = NULL, atualizado_em = NOW() WHERE id = ${id} AND foto_url IS NOT NULL RETURNING id, nome, cracha`;
  if (!row) return c.json({ erro: "Pessoa sem foto ou não encontrada." }, 404);
  try { await deletarFoto(id); } catch { }
  await registrarEvento(sessao, "pessoa.foto.removeu", `pessoas/${id}`, `${row.nome} (#${row.cracha})`);
  return c.json({ ok: true }, 200);
});

// DELETE /api/pessoas/:id
const deletePessoaRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Pessoas"],
  summary: "Deletar pessoa",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: z.object({ erro: z.string() }) } }, description: "Não encontrada" }
  }
});
app.openapi(deletePessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!podeAdministrar(sessao.perfil)) return c.json({ erro: "Acesso negado. Requer ADM ou ORG." }, 403);
  const [row] = await sql`DELETE FROM pessoas WHERE id = ${id} RETURNING id, nome, cracha`;
  if (!row) return c.json({ erro: "Pessoa não encontrada." }, 404);
  await registrarEvento(sessao, "pessoa.excluiu", `pessoas/${id}`, `${row.nome} (#${row.cracha})`);
  return c.json({ ok: true }, 200);
});

export default app;
