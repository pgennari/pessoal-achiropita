import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../db.js";
import { comAuth, escopoVeiculos, temPermissao } from "../auth.js";
import { registrarEvento } from "../auditoria.js";
import type { Variaveis } from "../tipos.js";

const app = new OpenAPIHono<Variaveis>();

const VeiculoSchema = z.object({
  id: z.string(),
  fabricante: z.string(),
  modelo: z.string(),
  placa: z.string(),
  cor: z.string(),
  estacionamentos: z.array(z.object({ id: z.string(), nome: z.string() })).optional(),
  observacao: z.string().nullable().optional(),
  crachaCarroImpresso: z.boolean().optional(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

const PessoaVeiculoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cracha: z.number().int(),
});

function veiculoDeRow(r: Record<string, unknown>) {
  const criadoEm = r.criado_em instanceof Date
    ? r.criado_em.toISOString()
    : String(r.criado_em ?? "");
  const atualizadoEm = r.atualizado_em instanceof Date
    ? r.atualizado_em.toISOString()
    : String(r.atualizado_em ?? "");
  return {
    id: r.id,
    fabricante: r.fabricante,
    modelo: r.modelo,
    placa: r.placa,
    cor: r.cor,
    estacionamentos: r.estacionamentos ?? [],
    observacao: r.observacao ?? null,
    crachaCarroImpresso: !!r.cracha_carro_impresso,
    criadoEm,
    atualizadoEm,
  };
}

const msgErro = z.object({ erro: z.string() });

// Estacionamentos derivados das vagas das pessoas ativas vinculadas (FR-010).
function selectVeiculoCompleto(where: ReturnType<typeof sql>) {
  return sql`
    SELECT v.*,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'cracha', p.cracha))
         FROM pessoa_veiculo pv
         JOIN pessoas p ON p.id = pv.pessoa_id
         WHERE pv.veiculo_id = v.id),
        '[]'::jsonb
      ) AS pessoas,
      COALESCE(
        (SELECT jsonb_agg(est) FROM (
          SELECT DISTINCT jsonb_build_object('id', e.id, 'nome', e.nome) AS est
          FROM pessoa_veiculo pv
          JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo
          JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
          JOIN vagas va ON va.id = pvg.vaga_id AND va.estacionamento_id IS NOT NULL
          JOIN estacionamentos e ON e.id = va.estacionamento_id
          WHERE pv.veiculo_id = v.id
        ) sub),
        '[]'::jsonb
      ) AS estacionamentos
    FROM veiculos v
    ${where}
    ORDER BY v.placa
  `;
}

// GET /api/veiculos
const getRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Veiculos"],
  summary: "Lista todos os veiculos",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.array(VeiculoSchema) } },
      description: "Lista de veiculos",
    },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
  },
});

app.openapi(getRoute, async (c) => {
  const sessao = c.get("sessao");
  const escopo = escopoVeiculos(sessao);
  if (!escopo) return c.json({ erro: "Acesso negado. Sem permissao de leitura de veiculos." }, 403);

  let where: ReturnType<typeof sql> = sql``;
  if (escopo === "equipe") {
    const equipes = sessao.equipesCRD ?? [];
    where = sql`WHERE EXISTS (
      SELECT 1 FROM pessoa_veiculo pv
      JOIN participacoes part ON part.pessoa_id = pv.pessoa_id
      JOIN edicoes e ON e.id = part.edicao_id AND e.status = 'ativa'
      WHERE pv.veiculo_id = v.id AND part.equipe_id = ANY(${equipes})
    )`;
  } else if (escopo === "proprio") {
    if (!sessao.pessoaId) return c.json([], 200);
    where = sql`WHERE EXISTS (
      SELECT 1 FROM pessoa_veiculo pv WHERE pv.veiculo_id = v.id AND pv.pessoa_id = ${sessao.pessoaId}
    )`;
  }

  const rows = await selectVeiculoCompleto(where);
  const resultado = rows.map((r) => ({ ...veiculoDeRow(r), pessoas: r.pessoas }));
  return c.json(resultado as any, 200);
});

// GET /api/veiculos/:id
const getIdRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Veiculos"],
  summary: "Busca veiculo por ID",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: VeiculoSchema } }, description: "Veiculo encontrado" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(getIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  const escopo = escopoVeiculos(sessao);
  if (!escopo) return c.json({ erro: "Acesso negado. Sem permissao de leitura de veiculos." }, 403);

  let filtro: ReturnType<typeof sql> = sql`WHERE v.id = ${id}`;
  if (escopo === "equipe") {
    const equipes = sessao.equipesCRD ?? [];
    filtro = sql`WHERE v.id = ${id} AND EXISTS (
      SELECT 1 FROM pessoa_veiculo pv
      JOIN participacoes part ON part.pessoa_id = pv.pessoa_id
      JOIN edicoes e ON e.id = part.edicao_id AND e.status = 'ativa'
      WHERE pv.veiculo_id = v.id AND part.equipe_id = ANY(${equipes})
    )`;
  } else if (escopo === "proprio") {
    if (!sessao.pessoaId) return c.json({ erro: "Veiculo nao encontrado." }, 404);
    filtro = sql`WHERE v.id = ${id} AND EXISTS (
      SELECT 1 FROM pessoa_veiculo pv WHERE pv.veiculo_id = v.id AND pv.pessoa_id = ${sessao.pessoaId}
    )`;
  }

  const [row] = await selectVeiculoCompleto(filtro);
  if (!row) return c.json({ erro: "Veiculo nao encontrado." }, 404);
  return c.json({ ...veiculoDeRow(row), pessoas: row.pessoas } as any, 200);
});

// POST /api/veiculos
const postRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Veiculos"],
  summary: "Cadastra novo veiculo",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            fabricante: z.string().optional(),
            modelo: z.string().optional(),
            placa: z.string(),
            cor: z.string().optional(),
            observacao: z.string().optional(),
            crachaCarroImpresso: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: VeiculoSchema } }, description: "Criado com sucesso" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Placa ja existe" },
  },
});

app.openapi(postRoute, async (c) => {
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "veiculos.incluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao veiculos.incluir." }, 403);
  }
  const body = c.req.valid("json");
  if (!body.placa.trim()) {
    return c.json({ erro: "placa e obrigatoria." }, 400);
  }

  const placaFormatada = body.placa.trim().toUpperCase();

  const [existente] = await sql`SELECT id FROM veiculos WHERE placa = ${placaFormatada}`;
  if (existente) {
    return c.json({ erro: "Ja existe veiculo com esta placa." }, 409);
  }

  const [row] = await sql`
    INSERT INTO veiculos (fabricante, modelo, placa, cor, observacao, cracha_carro_impresso)
    VALUES (
      ${body.fabricante?.trim() || null},
      ${body.modelo?.trim() || null},
      ${placaFormatada},
      ${body.cor?.trim() || null},
      ${body.observacao?.trim() || null},
      ${body.crachaCarroImpresso ?? false}
    )
    RETURNING *
  `;
  await registrarEvento(sessao, "veiculo.criou", `veiculos/${row.id}`, placaFormatada);
  return c.json(veiculoDeRow(row) as any, 201);
});

// PUT /api/veiculos/:id
const putRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Veiculos"],
  summary: "Atualiza veiculo",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            fabricante: z.string().optional(),
            modelo: z.string().optional(),
            placa: z.string(),
            cor: z.string().optional(),
            observacao: z.string().optional(),
            crachaCarroImpresso: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: VeiculoSchema } }, description: "Atualizado" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Placa ja existe" },
  },
});

app.openapi(putRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "veiculos.editar")) {
    return c.json({ erro: "Acesso negado. Requer permissao veiculos.editar." }, 403);
  }
  const body = c.req.valid("json");
  if (!body.placa.trim()) {
    return c.json({ erro: "placa e obrigatoria." }, 400);
  }

  const placaFormatada = body.placa.trim().toUpperCase();

  const [existente] = await sql`SELECT id FROM veiculos WHERE placa = ${placaFormatada} AND id != ${id}`;
  if (existente) {
    return c.json({ erro: "Ja existe veiculo com esta placa." }, 409);
  }

  const [row] = await sql`
    UPDATE veiculos SET
      fabricante = ${body.fabricante?.trim() || null},
      modelo = ${body.modelo?.trim() || null},
      placa = ${placaFormatada},
      cor = ${body.cor?.trim() || null},
      observacao = ${body.observacao?.trim() || null},
      cracha_carro_impresso = ${body.crachaCarroImpresso ?? false},
      atualizado_em = NOW()
    WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ erro: "Veiculo nao encontrado." }, 404);
  await registrarEvento(sessao, "veiculo.atualizou", `veiculos/${id}`, placaFormatada);
  return c.json(veiculoDeRow(row) as any, 200);
});

// DELETE /api/veiculos/:id
const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Veiculos"],
  summary: "Exclui veiculo",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Possui check-ins" },
  },
});

app.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "veiculos.excluir")) {
    return c.json({ erro: "Acesso negado. Requer permissao veiculos.excluir." }, 403);
  }

  const [existente] = await sql`SELECT id FROM checkins WHERE carro_id = ${id} LIMIT 1`;
  if (existente) {
    return c.json({ erro: "Veiculo possui check-ins registrados e nao pode ser excluido." }, 409);
  }

  const [row] = await sql`DELETE FROM veiculos WHERE id = ${id} RETURNING id, placa`;
  if (!row) return c.json({ erro: "Veiculo nao encontrado." }, 404);
  await registrarEvento(sessao, "veiculo.excluiu", `veiculos/${id}`, String(row.placa ?? ""));
  return c.json({ ok: true }, 200);
});

// GET /api/veiculos/:id/pessoas
const getPessoasRoute = createRoute({
  method: "get",
  path: "/{id}/pessoas",
  tags: ["Veiculos"],
  summary: "Lista pessoas vinculadas ao veiculo",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.array(PessoaVeiculoSchema) } }, description: "Lista de pessoas" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Veiculo nao encontrado" },
  },
});

app.openapi(getPessoasRoute, async (c) => {
  const { id } = c.req.valid("param");
  const [veiculo] = await sql`SELECT id FROM veiculos WHERE id = ${id}`;
  if (!veiculo) return c.json({ erro: "Veiculo nao encontrado." }, 404);
  const rows = await sql`
    SELECT p.id, p.nome, p.cracha FROM pessoas p
    JOIN pessoa_veiculo pv ON pv.pessoa_id = p.id
    WHERE pv.veiculo_id = ${id}
    ORDER BY p.nome
  `;
  return c.json(rows as any, 200);
});

// POST /api/veiculos/:id/pessoas
const postPessoaRoute = createRoute({
  method: "post",
  path: "/{id}/pessoas",
  tags: ["Veiculos"],
  summary: "Vincula pessoa ao veiculo",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.object({ pessoaId: z.string() }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    400: { content: { "application/json": { schema: msgErro } }, description: "Dados invalidos" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
    409: { content: { "application/json": { schema: msgErro } }, description: "Pessoa ja vinculada" },
  },
});

app.openapi(postPessoaRoute, async (c) => {
  const { id } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "veiculos.vincular")) {
    return c.json({ erro: "Acesso negado. Requer permissao veiculos.vincular." }, 403);
  }
  const { pessoaId } = c.req.valid("json");
  const [veiculo] = await sql`SELECT id FROM veiculos WHERE id = ${id}`;
  if (!veiculo) return c.json({ erro: "Veiculo nao encontrado." }, 404);
  const [pessoa] = await sql`SELECT id, nome FROM pessoas WHERE id = ${pessoaId}`;
  if (!pessoa) return c.json({ erro: "Pessoa nao encontrada." }, 404);

  const [existente] = await sql`SELECT veiculo_id FROM pessoa_veiculo WHERE pessoa_id = ${pessoaId} AND veiculo_id = ${id}`;
  if (existente) {
    return c.json({ erro: "Pessoa ja vinculada a este veiculo." }, 409);
  }

  await sql`INSERT INTO pessoa_veiculo (pessoa_id, veiculo_id) VALUES (${pessoaId}, ${id})`;
  await registrarEvento(sessao, "veiculo.pessoa.vinculou", `veiculos/${id}`, `${pessoa.nome} (#${pessoaId})`);
  return c.json({ ok: true }, 200);
});

// DELETE /api/veiculos/:id/pessoas/:pessoaId
const deletePessoaRoute = createRoute({
  method: "delete",
  path: "/{id}/pessoas/{pessoaId}",
  tags: ["Veiculos"],
  summary: "Desvincula pessoa do veiculo",
  middleware: [comAuth as any] as const,
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string(), pessoaId: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: z.object({ ok: z.boolean() }) } }, description: "Sucesso" },
    403: { content: { "application/json": { schema: msgErro } }, description: "Acesso negado" },
    404: { content: { "application/json": { schema: msgErro } }, description: "Nao encontrado" },
  },
});

app.openapi(deletePessoaRoute, async (c) => {
  const { id, pessoaId } = c.req.valid("param");
  const sessao = c.get("sessao");
  if (!temPermissao(sessao, "veiculos.vincular")) {
    return c.json({ erro: "Acesso negado. Requer permissao veiculos.vincular." }, 403);
  }

  const [existente] = await sql`SELECT veiculo_id FROM pessoa_veiculo WHERE pessoa_id = ${pessoaId} AND veiculo_id = ${id}`;
  if (!existente) return c.json({ erro: "Vinculo nao encontrado." }, 404);

  const [pessoa] = await sql`SELECT id, nome FROM pessoas WHERE id = ${pessoaId}`;
  await sql`DELETE FROM pessoa_veiculo WHERE pessoa_id = ${pessoaId} AND veiculo_id = ${id}`;
  await registrarEvento(sessao, "veiculo.pessoa.desvinculou", `veiculos/${id}`, `${pessoa?.nome ?? ""} (#${pessoaId})`);
  return c.json({ ok: true }, 200);
});

export default app;
